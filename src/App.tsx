import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { AppContext, type AppCtx } from "./context";
import { soldeCaisse } from "./lib/calc";
import { fmtFcfa } from "./lib/format";
import {
  chargerEtat, detecterMode, estLectureSeule, lectureSeuleMemorisee, lireFlash,
  memoriserLectureSeule, memoriserTresorier, poserFlash, sauvegarder, tresorierMemorise,
} from "./storage";
import type { AppState } from "./types";
import { Appels } from "./components/Appels";
import { Caisse, copierTexte } from "./components/Caisse";
import { Dashboard } from "./components/Dashboard";
import { Manoeuvre } from "./components/Manoeuvre";
import { Membres } from "./components/Membres";
import { Payer } from "./components/Payer";
import { Reglages } from "./components/Reglages";
import { Field, IcoLock, IcoPalm, IcoUnlock, Modal } from "./components/ui";

export type Onglet = "tableau" | "payer" | "caisse" | "membres" | "manoeuvre" | "appels" | "reglages";

const ONGLETS: { id: Onglet; label: string }[] = [
  { id: "tableau", label: "Tableau de bord" },
  { id: "payer", label: "Payer" },
  { id: "caisse", label: "Caisse" },
  { id: "membres", label: "Membres" },
  { id: "manoeuvre", label: "Manœuvre" },
  { id: "appels", label: "Appels de fonds" },
  { id: "reglages", label: "Réglages" },
];

const mode = detecterMode();

export default function App() {
  const flash = useMemo(() => lireFlash(), []);
  const [state, setState] = useState<AppState>(() => chargerEtat(mode));
  const [onglet, setOnglet] = useState<Onglet>((flash?.onglet as Onglet) ?? "tableau");
  const [membreSel, setMembreSel] = useState<string | undefined>(flash?.membre);
  const [toast, setToast] = useState<{ message: string; erreur: boolean } | null>(flash ? { message: flash.message, erreur: false } : null);
  /** Le trésorier a saisi son code sur cet appareil : les commandes de saisie sont affichées. */
  const [tresorier, setTresorier] = useState<boolean>(() => tresorierMemorise());
  /** La page a refusé un enregistrement (pas le droit d'écriture sur ce partage). */
  const [refusEcriture, setRefusEcriture] = useState<boolean>(() => mode === "artifact" && lectureSeuleMemorisee());
  const [enregistrement, setEnregistrement] = useState(false);
  const [pinOuvert, setPinOuvert] = useState(false);
  const [pin, setPin] = useState("");
  const [pinErreur, setPinErreur] = useState("");

  const lectureSeule = !tresorier || refusEcriture;

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), toast.erreur ? 6000 : 3000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const notifier = useCallback((message: string, erreur = false) => setToast({ message, erreur }), []);

  const commit = useCallback(async (next: AppState, message: string): Promise<boolean> => {
    const precedent = state;
    setState(next);
    setEnregistrement(true);
    const r = await sauvegarder(mode, next);
    setEnregistrement(false);
    if (r.ok) {
      if (r.rechargement) {
        poserFlash({ message, onglet, membre: membreSel });
        setToast({ message: "Enregistré — mise à jour de la page…", erreur: false });
      } else {
        notifier(message);
      }
      return true;
    }
    setState(precedent);
    if (estLectureSeule(r.code)) {
      setRefusEcriture(true);
      memoriserLectureSeule(true);
    }
    notifier(r.message, true);
    return false;
  }, [state, onglet, membreSel, notifier]);

  const telecharger = useCallback(async (nom: string, contenu: string, type: string) => {
    if (mode === "artifact") {
      const dl = (await window.claude!.use("downloads")) as { save(r: { filename: string; data: string }): Promise<unknown> } | null;
      if (dl) {
        try {
          await dl.save({ filename: nom, data: contenu });
          notifier("Fichier enregistré");
          return;
        } catch (e) {
          const code = (e as { code?: string })?.code;
          if (code === "declined") return;
          if (code === "rate_limited") return notifier("Un téléchargement est déjà en attente.", true);
        }
      }
      const ok = await copierTexte(contenu);
      notifier(ok ? "Téléchargement indisponible ici : contenu copié dans le presse-papiers." : "Téléchargement indisponible ici.", !ok);
      return;
    }
    const blob = new Blob([contenu], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nom;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [notifier]);

  const demanderTresorier = useCallback(() => setPinOuvert(true), []);
  const ctx: AppCtx = { state, mode, lectureSeule, tresorier, demanderTresorier, enregistrement, commit, telecharger, notifier };

  const aller = (o: Onglet, membreId?: string) => {
    setMembreSel(membreId);
    setOnglet(o);
    window.scrollTo({ top: 0 });
  };

  function validerPin(e: FormEvent) {
    e.preventDefault();
    if (pin.trim() !== state.settings.pinTresorier) {
      setPinErreur("Code incorrect.");
      return;
    }
    setTresorier(true);
    memoriserTresorier(true);
    setPinOuvert(false);
    setPin("");
    setPinErreur("");
    notifier("Mode trésorier activé");
  }

  function verrouiller() {
    setTresorier(false);
    memoriserTresorier(false);
    notifier("Mode consultation");
  }

  return (
    <AppContext.Provider value={ctx}>
      <div className="app">
        <header className="topbar">
          <div className="topbar-inner">
            <div className="brand">
              <div className="brand-mark"><IcoPalm /></div>
              <div style={{ minWidth: 0 }}>
                <h1>{state.settings.nom}</h1>
                <div className="brand-sub">Cotisations · caisse · manœuvre</div>
              </div>
            </div>
            <div className="btn-row" style={{ flexWrap: "nowrap" }}>
              <div className="solde-chip">
                <div className="label">En caisse</div>
                <div className="value">{fmtFcfa(soldeCaisse(state))}</div>
              </div>
              {tresorier ? (
                <button type="button" className="btn sm" onClick={verrouiller} title="Repasser en consultation"><IcoUnlock /> <span className="lock-label">Trésorier</span></button>
              ) : (
                <button type="button" className="btn ghost sm" onClick={() => setPinOuvert(true)} title="Mode trésorier"><IcoLock /> <span className="lock-label">Trésorier</span></button>
              )}
            </div>
          </div>
          <nav className="tabs" role="tablist" aria-label="Sections">
            {ONGLETS.map((o) => (
              <button key={o.id} type="button" role="tab" className="tab" aria-selected={onglet === o.id} onClick={() => aller(o.id)}>
                {o.label}
              </button>
            ))}
          </nav>
          {tresorier ? (
            <div className="mode-bar actif">
              <span><IcoUnlock /> Mode trésorier : vous pouvez enregistrer cotisations, salaires et dépenses.</span>
              <button type="button" className="btn ghost sm" onClick={verrouiller}>Verrouiller</button>
            </div>
          ) : (
            <div className="mode-bar">
              <span>Consultation · les membres voient la caisse et paient leurs charges.</span>
              <button type="button" className="btn sm" onClick={() => setPinOuvert(true)}><IcoLock /> Je suis le trésorier</button>
            </div>
          )}
        </header>

        <main className="main">
          {tresorier && refusEcriture && (
            <div className="banner">Vous n'avez pas le droit d'enregistrer sur cette page : seul le propriétaire du partage (le trésorier) le peut. Vous êtes en consultation.</div>
          )}
          {mode === "local" && tresorier && (
            <div className="banner info">Mode local : les données sont conservées dans ce navigateur. Pensez à exporter une sauvegarde depuis Réglages.</div>
          )}
          {onglet === "tableau" && <Dashboard aller={aller} />}
          {onglet === "payer" && <Payer />}
          {onglet === "caisse" && <Caisse />}
          {onglet === "membres" && <Membres selection={membreSel} onSelection={setMembreSel} />}
          {onglet === "manoeuvre" && <Manoeuvre />}
          {onglet === "appels" && <Appels />}
          {onglet === "reglages" && <Reglages />}
        </main>

        {pinOuvert && (
          <Modal titre="Mode trésorier" onClose={() => { setPinOuvert(false); setPin(""); setPinErreur(""); }}>
            <form onSubmit={validerPin} className="form-grid">
              <p className="small muted span-2">Saisissez le code du trésorier pour afficher les commandes de saisie. Les membres n'en ont pas besoin pour consulter la caisse ou payer.</p>
              <Field label="Code" span2>
                <input type="password" inputMode="numeric" autoComplete="off" autoFocus value={pin} onChange={(e) => setPin(e.target.value)} />
              </Field>
              {pinErreur && <p className="error span-2">{pinErreur}</p>}
              <div className="btn-row end span-2">
                <button type="button" className="btn" onClick={() => { setPinOuvert(false); setPin(""); setPinErreur(""); }}>Annuler</button>
                <button type="submit" className="btn primary">Déverrouiller</button>
              </div>
            </form>
          </Modal>
        )}

        {toast && <div className={`toast ${toast.erreur ? "error" : ""}`} role="status">{toast.message}</div>}
      </div>
    </AppContext.Provider>
  );
}
