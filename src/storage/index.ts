import seed from "../data/seed.json";
import type { AppState } from "../types";

/**
 * Deux modes de stockage, décidés au démarrage :
 *
 * - `artifact` : la page tourne dans le lecteur claude.ai. L'état vit dans
 *   le bloc <script id="app-state"> du document ; enregistrer = publier une
 *   nouvelle version complète de la page (capacité `artifact`). Tous les
 *   lecteurs sont rechargés sur la nouvelle version.
 * - `server` : la page est hébergée à côté de `server/api.php` (hébergement
 *   mutualisé). L'état vit dans data/state.json sur le serveur ; lecture
 *   libre, écriture avec le code trésorier (en-tête X-Pin).
 * - `local` : ni l'un ni l'autre (développement, fichier ouvert seul).
 *   L'état est conservé dans le localStorage du navigateur.
 *
 * Au démarrage on ne peut distinguer `server` de `local` qu'en interrogeant
 * api.php : voir `sonderServeur()`.
 */
export type ModeStockage = "artifact" | "server" | "local";

export type ResultatSauvegarde =
  | { ok: true; rechargement: boolean }
  | { ok: false; code: string; message: string; etat?: AppState };

declare global {
  interface Window {
    claude?: { use(name: string): Promise<unknown> };
  }
}

interface ArtifactNs {
  publish(html: string): Promise<{ version: string }>;
}

const CLE_LOCAL = "caisse-palmeraie:etat";
const CLE_FLASH = "caisse-palmeraie:flash";
const CLE_LECTURE_SEULE = "caisse-palmeraie:lecture-seule";
const CLE_TRESORIER = "caisse-palmeraie:tresorier";
const CLE_PIN = "caisse-palmeraie:pin";
const API = "api.php";
let versionServeur = "vide";
const CLE_MEMBRE = "caisse-palmeraie:membre";

export function detecterMode(): ModeStockage {
  return typeof window.claude?.use === "function" ? "artifact" : "local";
}

/** Normalise un état venu du JSON (bloc intégré, localStorage, import). */
export function normaliser(x: unknown): AppState {
  const o = (x && typeof x === "object" ? x : {}) as Partial<AppState>;
  const base = seed as AppState;
  const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  return {
    version: 1,
    settings: {
      ...base.settings,
      ...(o.settings ?? {}),
      paiement: { ...base.settings.paiement, ...(o.settings?.paiement ?? {}) },
    },
    membres: arr(o.membres),
    manoeuvres: arr(o.manoeuvres),
    taches: arr(o.taches),
    appels: arr(o.appels),
    mouvements: arr(o.mouvements),
  };
}

export function lireEtatIntegre(): AppState | null {
  const el = document.getElementById("app-state");
  const txt = el?.textContent?.trim();
  if (!txt) return null;
  try {
    return normaliser(JSON.parse(txt));
  } catch {
    return null;
  }
}

export function chargerEtat(mode: ModeStockage): AppState {
  if (mode === "local") {
    try {
      const raw = localStorage.getItem(CLE_LOCAL);
      if (raw) return normaliser(JSON.parse(raw));
    } catch {
      /* stockage indisponible : on repart du document */
    }
  }
  return lireEtatIntegre() ?? normaliser(seed);
}

/**
 * Reconstruit le document complet à partir de ses parties statiques
 * (marquées `data-app` au build) et du nouvel état. On ne sérialise jamais
 * le DOM vivant : seul le texte source des balises style/script est repris.
 */
export function construireDocument(state: AppState): string {
  const titre = document.title || "Caisse de la Palmeraie";
  const liens = Array.from(document.querySelectorAll("link[data-app]")).map((l) => l.outerHTML);
  const styles = Array.from(document.querySelectorAll("style[data-app]")).map((s) => s.textContent ?? "");
  const script = document.querySelector('script[type="module"][data-app]');
  if (!script?.textContent) {
    throw new Error("Le code de la page est introuvable : ce fichier n'a pas été produit par le build.");
  }
  const json = JSON.stringify(state).replace(/</g, "\\u003c");
  // Les balises sont assemblées morceau par morceau pour que le code compilé
  // ne contienne jamais les chaînes "<body>", "</head>", etc. : le script de
  // build et tout outil qui découpe le HTML pourraient sinon s'y tromper.
  const o = (t: string) => "<" + t + ">";
  const f = (t: string) => "</" + t + ">";
  return [
    "<!doctype html>",
    o('html lang="fr"'),
    o("head"),
    o('meta charset="utf-8" /'),
    o('meta name="viewport" content="width=device-width, initial-scale=1" /'),
    o("title") + titre + f("title"),
    ...liens,
    o("style data-app") + styles.join("\n") + f("style"),
    f("head"),
    o("body"),
    o('script id="app-state" type="application/json" data-app') + json + f("script"),
    o('div id="root"') + f("div"),
    o('script type="module" data-app') + script.textContent + f("script"),
    f("body"),
    f("html"),
    "",
  ].join("\n");
}

const MESSAGES: Record<string, string> = {
  conflict: "Quelqu'un vient d'enregistrer une autre version. La page se recharge avec les dernières données.",
  not_writer: "Vous consultez cette caisse en lecture seule : seul le trésorier peut enregistrer.",
  not_granted: "Vous consultez cette caisse en lecture seule.",
  not_declared: "L'enregistrement n'est pas activé sur cette page.",
  too_large: "La caisse est devenue trop volumineuse pour être enregistrée. Exportez les données puis archivez les anciens mouvements.",
  rate_limited: "Trop d'enregistrements d'affilée. Patientez quelques secondes puis réessayez.",
  upstream_error: "Le service n'a pas répondu. Réessayez dans un instant.",
};

export function estLectureSeule(code: string): boolean {
  return code === "not_writer" || code === "not_granted" || code === "not_declared" || code === "capability_disabled";
}

export async function sauvegarder(mode: ModeStockage, state: AppState): Promise<ResultatSauvegarde> {
  if (mode === "server") return sauvegarderServeur(state);
  if (mode === "local") {
    try {
      localStorage.setItem(CLE_LOCAL, JSON.stringify(state));
      return { ok: true, rechargement: false };
    } catch {
      return { ok: false, code: "local", message: "Le navigateur refuse d'enregistrer (stockage plein ou désactivé)." };
    }
  }
  const artifact = (await window.claude!.use("artifact")) as ArtifactNs | null;
  if (!artifact) {
    return { ok: false, code: "not_granted", message: "Ouvrez la page depuis claude.ai pour pouvoir enregistrer." };
  }
  let html: string;
  try {
    html = construireDocument(state);
  } catch (e) {
    return { ok: false, code: "build", message: (e as Error).message };
  }
  try {
    await artifact.publish(html);
    return { ok: true, rechargement: true };
  } catch (e) {
    const code = (e as { code?: string })?.code ?? "upstream_error";
    return { ok: false, code, message: MESSAGES[code] ?? MESSAGES.upstream_error };
  }
}

// ------------------------------------------------ mémoire entre deux versions

export interface Flash {
  message: string;
  onglet?: string;
  membre?: string;
}

export function poserFlash(f: Flash): void {
  try {
    sessionStorage.setItem(CLE_FLASH, JSON.stringify(f));
  } catch {
    /* ignoré */
  }
}

let flashLu: Flash | null | undefined;

/** Lu une seule fois par chargement de page (idempotent, même en StrictMode). */
export function lireFlash(): Flash | null {
  if (flashLu !== undefined) return flashLu;
  try {
    const raw = sessionStorage.getItem(CLE_FLASH);
    sessionStorage.removeItem(CLE_FLASH);
    flashLu = raw ? (JSON.parse(raw) as Flash) : null;
  } catch {
    flashLu = null;
  }
  return flashLu;
}

export function memoriserLectureSeule(v: boolean): void {
  try {
    if (v) sessionStorage.setItem(CLE_LECTURE_SEULE, "1");
    else sessionStorage.removeItem(CLE_LECTURE_SEULE);
  } catch {
    /* ignoré */
  }
}

export function lectureSeuleMemorisee(): boolean {
  try {
    return sessionStorage.getItem(CLE_LECTURE_SEULE) === "1";
  } catch {
    return false;
  }
}

export function effacerLocal(): void {
  try {
    localStorage.removeItem(CLE_LOCAL);
  } catch {
    /* ignoré */
  }
}

// ------------------------------------------------ préférences d'affichage

export function memoriserTresorier(v: boolean): void {
  try {
    if (v) sessionStorage.setItem(CLE_TRESORIER, "1");
    else sessionStorage.removeItem(CLE_TRESORIER);
  } catch {
    /* ignoré */
  }
}

export function tresorierMemorise(): boolean {
  try {
    return sessionStorage.getItem(CLE_TRESORIER) === "1";
  } catch {
    return false;
  }
}

/** Membre choisi dans l'espace « Payer », retenu sur cet appareil. */
export function memoriserMembre(id: string): void {
  try {
    localStorage.setItem(CLE_MEMBRE, id);
  } catch {
    /* ignoré */
  }
}

export function membreMemorise(): string | null {
  try {
    return localStorage.getItem(CLE_MEMBRE);
  } catch {
    return null;
  }
}

// --------------------------------------------------------- mode serveur

export function pinMemorise(): string {
  try {
    return sessionStorage.getItem(CLE_PIN) ?? "";
  } catch {
    return "";
  }
}

export function memoriserPin(pin: string): void {
  try {
    if (pin) sessionStorage.setItem(CLE_PIN, pin);
    else sessionStorage.removeItem(CLE_PIN);
  } catch {
    /* ignoré */
  }
}

async function appelApi(url: string, init: RequestInit, delaiMs = 6000): Promise<Response> {
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), delaiMs);
  try {
    return await fetch(url, { cache: "no-store", ...init, signal: ctrl.signal });
  } finally {
    window.clearTimeout(t);
  }
}

/** Interroge api.php ; `null` si absent (mode local). `etat` est null tant que rien n'a été enregistré. */
export async function sonderServeur(): Promise<{ etat: AppState | null; version: string } | null> {
  try {
    const r = await appelApi(API, { headers: { Accept: "application/json" } }, 4000);
    if (!r.ok || !(r.headers.get("content-type") ?? "").includes("application/json")) return null;
    const j = (await r.json()) as { state?: unknown; version?: string };
    if (!j || typeof j !== "object" || !("state" in j)) return null;
    versionServeur = j.version ?? "vide";
    return { etat: j.state ? normaliser(j.state) : null, version: versionServeur };
  } catch {
    return null;
  }
}

/** Nouvel état si le serveur a changé depuis la dernière lecture, sinon null. */
export async function rafraichirServeur(): Promise<AppState | null> {
  const avant = versionServeur;
  const r = await sonderServeur();
  if (!r || !r.etat || r.version === avant) return null;
  return r.etat;
}

export async function verifierPinServeur(pin: string): Promise<{ ok: boolean; message?: string }> {
  try {
    const r = await appelApi(`${API}?action=verify`, { method: "POST", headers: { "X-Pin": pin } });
    if (r.ok) {
      memoriserPin(pin);
      return { ok: true };
    }
    if (r.status === 423) {
      const j = (await r.json().catch(() => ({}))) as { reessayer_dans?: number };
      return { ok: false, message: `Trop de tentatives. Réessayez dans ${Math.max(1, Math.ceil((j.reessayer_dans ?? 600) / 60))} min.` };
    }
    return { ok: false, message: "Code incorrect." };
  } catch {
    return { ok: false, message: "Serveur injoignable. Vérifiez la connexion." };
  }
}

async function sauvegarderServeur(state: AppState): Promise<ResultatSauvegarde> {
  try {
    const r = await appelApi(`${API}?action=save`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Pin": pinMemorise(), "If-Match": versionServeur },
      body: JSON.stringify(state),
    }, 15000);
    if (r.ok) {
      const j = (await r.json()) as { version?: string };
      versionServeur = j.version ?? versionServeur;
      if (state.settings.pinTresorier) memoriserPin(state.settings.pinTresorier);
      return { ok: true, rechargement: false };
    }
    if (r.status === 401) return { ok: false, code: "pin", message: "Code trésorier refusé : saisissez-le à nouveau." };
    if (r.status === 423) return { ok: false, code: "pin", message: "Trop de tentatives de code : patientez 10 minutes." };
    if (r.status === 409) {
      const j = (await r.json()) as { state?: unknown; version?: string };
      versionServeur = j.version ?? versionServeur;
      return {
        ok: false, code: "conflict",
        message: "Quelqu'un a enregistré entre-temps : la page affiche la dernière version. Recommencez votre saisie.",
        etat: j.state ? normaliser(j.state) : undefined,
      };
    }
    const j = (await r.json().catch(() => ({}))) as { message?: string };
    return { ok: false, code: "upstream_error", message: j.message ?? `Le serveur a répondu ${r.status}.` };
  } catch {
    return { ok: false, code: "upstream_error", message: "Serveur injoignable : rien n'a été enregistré. Réessayez." };
  }
}
