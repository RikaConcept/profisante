import { useCallback, useEffect, useMemo, useState } from "react";
import { AppContext, type AppCtx } from "./context";
import { soldeCaisse } from "./lib/calc";
import { fmtFcfa } from "./lib/format";
import {
  chargerEtat, detecterMode, estLectureSeule, lectureSeuleMemorisee, lireFlash,
  memoriserLectureSeule, poserFlash, sauvegarder,
} from "./storage";
import type { AppState } from "./types";
import { Appels } from "./components/Appels";
import { Caisse, copierTexte } from "./components/Caisse";
import { Dashboard } from "./components/Dashboard";
import { Manoeuvre } from "./components/Manoeuvre";
import { Membres } from "./components/Membres";
import { Reglages } from "./components/Reglages";
import { IcoPalm } from "./components/ui";

export type Onglet = "tableau" | "caisse" | "membres" | "manoeuvre" | "appels" | "reglages";

const ONGLETS: { id: Onglet; label: string }[] = [
  { id: "tableau", label: "Tableau de bord" },
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
  const [lectureSeule, setLectureSeule] = useState(() => mode === "artifact" && lectureSeuleMemorisee());
  const [enregistrement, setEnregistrement] = useState(false);

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
      setLectureSeule(true);
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

  const ctx: AppCtx = { state, mode, lectureSeule, enregistrement, commit, telecharger, notifier };

  const aller = (o: Onglet, membreId?: string) => {
    setMembreSel(membreId);
    setOnglet(o);
    window.scrollTo({ top: 0 });
  };

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
            <div className="solde-chip">
              <div className="label">En caisse</div>
              <div className="value">{fmtFcfa(soldeCaisse(state))}</div>
            </div>
          </div>
          <nav className="tabs" role="tablist" aria-label="Sections">
            {ONGLETS.map((o) => (
              <button key={o.id} type="button" role="tab" className="tab" aria-selected={onglet === o.id} onClick={() => aller(o.id)}>
                {o.label}
              </button>
            ))}
          </nav>
        </header>

        <main className="main">
          {lectureSeule && (
            <div className="banner">Consultation seule : vous pouvez suivre la caisse, mais seul le trésorier peut enregistrer des opérations.</div>
          )}
          {mode === "local" && (
            <div className="banner info">Mode local : les données sont conservées dans ce navigateur. Pensez à exporter une sauvegarde depuis Réglages.</div>
          )}
          {onglet === "tableau" && <Dashboard aller={aller} />}
          {onglet === "caisse" && <Caisse />}
          {onglet === "membres" && <Membres selection={membreSel} onSelection={setMembreSel} />}
          {onglet === "manoeuvre" && <Manoeuvre />}
          {onglet === "appels" && <Appels />}
          {onglet === "reglages" && <Reglages />}
        </main>

        {toast && <div className={`toast ${toast.erreur ? "error" : ""}`} role="status">{toast.message}</div>}
      </div>
    </AppContext.Provider>
  );
}
