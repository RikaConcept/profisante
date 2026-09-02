import seed from "../data/seed.json";
import type { AppState } from "../types";

/**
 * Deux modes de stockage, décidés au démarrage :
 *
 * - `artifact` : la page tourne dans le lecteur claude.ai. L'état vit dans
 *   le bloc <script id="app-state"> du document ; enregistrer = publier une
 *   nouvelle version complète de la page (capacité `artifact`). Tous les
 *   lecteurs sont rechargés sur la nouvelle version.
 * - `local` : la page est ouverte ailleurs (développement, hébergement
 *   classique). L'état est conservé dans le localStorage du navigateur.
 */
export type ModeStockage = "artifact" | "local";

export type ResultatSauvegarde =
  | { ok: true; rechargement: boolean }
  | { ok: false; code: string; message: string };

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
    settings: { ...base.settings, ...(o.settings ?? {}) },
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
  return [
    "<!doctype html>",
    '<html lang="fr">',
    "<head>",
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<title>${titre}</title>`,
    ...liens,
    `<style data-app>${styles.join("\n")}</style>`,
    "</head>",
    "<body>",
    `<script id="app-state" type="application/json" data-app>${json}</script>`,
    '<div id="root"></div>',
    `<script type="module" data-app>${script.textContent}</script>`,
    "</body>",
    "</html>",
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
