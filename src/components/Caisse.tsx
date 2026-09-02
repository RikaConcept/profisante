import { useMemo, useState } from "react";
import { useApp } from "../context";
import { TYPES, avecSoldeCourant, estEntree, moisDisponibles, resumeMois } from "../lib/calc";
import { fmtDate, fmtFcfa, fmtMois, fmtMoisCourt, fmtNombre, moisCourant, moisDeDate } from "../lib/format";
import { csvRegistre, rapportMois } from "../lib/report";
import type { Mouvement } from "../types";
import { MouvementForm } from "./forms";
import { Amount, Empty, IcoCopy, IcoDown, IcoPlus, Modal, Stat } from "./ui";

type Modale = null | { mode: "nouveau" } | { mode: "edition"; mouvement: Mouvement } | { mode: "rapport" };

export async function copierTexte(txt: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(txt);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = txt;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

export function Caisse() {
  const { state, commit, lectureSeule, telecharger, notifier } = useApp();
  // Par défaut : le mois en cours, ou le dernier mois qui a des opérations.
  const [mois, setMois] = useState<string>(() => {
    const courant = moisCourant();
    if (state.mouvements.some((v) => moisDeDate(v.date) === courant)) return courant;
    const dernier = state.mouvements.map((v) => moisDeDate(v.date)).sort().pop();
    return dernier ?? courant;
  });
  const [modale, setModale] = useState<Modale>(null);
  const moisListe = moisDisponibles(state);
  const filtreActif = mois !== "tous";

  const lignes = useMemo(() => {
    const toutes = avecSoldeCourant(state).reverse();
    return filtreActif ? toutes.filter((l) => moisDeDate(l.mouvement.date) === mois) : toutes;
  }, [state, mois, filtreActif]);
  const r = filtreActif ? resumeMois(state, mois) : null;
  const nomMembre = (id?: string) => state.membres.find((m) => m.id === id)?.nom;

  async function enregistrer(v: Mouvement) {
    const existe = state.mouvements.some((x) => x.id === v.id);
    const mouvements = existe ? state.mouvements.map((x) => (x.id === v.id ? v : x)) : [...state.mouvements, v];
    setModale(null);
    await commit({ ...state, mouvements }, existe ? "Mouvement modifié" : "Mouvement ajouté");
  }

  async function supprimer(v: Mouvement) {
    if (!window.confirm(`Supprimer « ${v.libelle} » (${fmtFcfa(v.montant)}) ?`)) return;
    setModale(null);
    await commit({ ...state, mouvements: state.mouvements.filter((x) => x.id !== v.id) }, "Mouvement supprimé");
  }

  const texteRapport = filtreActif ? rapportMois(state, mois) : "";

  return (
    <>
      <div className="section-head">
        <div>
          <h2>Caisse</h2>
          <p className="sub">Toutes les entrées et sorties, avec le solde après chaque opération.</p>
        </div>
        {!lectureSeule && (
          <button type="button" className="btn primary" onClick={() => setModale({ mode: "nouveau" })}><IcoPlus /> Mouvement</button>
        )}
      </div>

      <div className="toolbar">
        <select value={mois} onChange={(e) => setMois(e.target.value)} aria-label="Mois affiché">
          <option value="tous">Tout l'historique</option>
          {moisListe.map((m) => <option key={m} value={m}>{fmtMois(m)}</option>)}
        </select>
        <span className="spacer" />
        {filtreActif && <button type="button" className="btn sm" onClick={() => setModale({ mode: "rapport" })}><IcoCopy /> Rapport du mois</button>}
        <button type="button" className="btn sm" onClick={() => telecharger(`caisse-${state.settings.nom.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`, csvRegistre(state), "text/csv")}><IcoDown /> CSV</button>
      </div>

      {r && (
        <div className="grid-stats">
          <Stat label="Solde début de mois" value={<span className="amount">{fmtNombre(r.soldeDebut)}</span>} />
          <Stat label="Entrées" value={<span className="amount in">{fmtNombre(r.entrees)}</span>} hint={`Cotisations : ${fmtNombre(r.parType.cotisation ?? 0)}`} />
          <Stat label="Sorties" value={<span className="amount out">{fmtNombre(r.sorties)}</span>} hint={`Salaires : ${fmtNombre(r.parType.salaire ?? 0)}`} />
          <Stat label="Solde fin de mois" value={<span className="amount">{fmtNombre(r.soldeFin)}</span>} />
        </div>
      )}

      <section className="card">
        {lignes.length === 0 ? <Empty>Aucun mouvement {filtreActif ? `en ${fmtMois(mois).toLowerCase()}` : "enregistré"}.</Empty> : (
          <div className="table-wrap">
            <table className="ledger">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Opération</th>
                  <th>Mois</th>
                  <th className="num">Entrée</th>
                  <th className="num">Sortie</th>
                  <th className="num">Solde</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map(({ mouvement: v, solde }) => {
                  const entree = estEntree(v.type);
                  const qui = nomMembre(v.membreId) ?? state.manoeuvres.find((w) => w.id === v.manoeuvreId)?.nom;
                  return (
                    <tr key={v.id} className={lectureSeule ? "" : "clickable"}
                      onClick={() => !lectureSeule && setModale({ mode: "edition", mouvement: v })}>
                      <td style={{ whiteSpace: "nowrap" }}>{fmtDate(v.date)}</td>
                      <td>
                        <span className="cell-main">{v.libelle}</span>
                        <span className="cell-sub">{TYPES[v.type].label}{qui && !v.libelle.includes(qui) ? ` · ${qui}` : ""}{v.note ? ` · ${v.note}` : ""}</span>
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>{fmtMoisCourt(v.mois)}</td>
                      <td className="num">{entree && <Amount n={v.montant} className="in" />}</td>
                      <td className="num">{!entree && <Amount n={v.montant} className="out" />}</td>
                      <td className="num"><Amount n={solde} /></td>
                    </tr>
                  );
                })}
              </tbody>
              {r && (
                <tfoot>
                  <tr>
                    <td colSpan={3}>Total {fmtMois(mois).toLowerCase()}</td>
                    <td className="num"><Amount n={r.entrees} className="in" /></td>
                    <td className="num"><Amount n={r.sorties} className="out" /></td>
                    <td className="num"><Amount n={r.soldeFin} /></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </section>

      {modale?.mode === "nouveau" && (
        <Modal titre="Nouveau mouvement" onClose={() => setModale(null)}>
          <MouvementForm onSubmit={enregistrer} onCancel={() => setModale(null)} defaults={filtreActif ? { mois } : undefined} />
        </Modal>
      )}
      {modale?.mode === "edition" && (
        <Modal titre="Modifier le mouvement" onClose={() => setModale(null)}>
          <MouvementForm initial={modale.mouvement} onSubmit={enregistrer} onCancel={() => setModale(null)} onDelete={() => supprimer(modale.mouvement)} />
        </Modal>
      )}
      {modale?.mode === "rapport" && (
        <Modal titre={`Rapport — ${fmtMois(mois)}`} onClose={() => setModale(null)}>
          <p className="small muted">Texte prêt à coller dans le groupe WhatsApp.</p>
          <pre>{texteRapport}</pre>
          <div className="btn-row end">
            <button type="button" className="btn" onClick={() => setModale(null)}>Fermer</button>
            <button type="button" className="btn primary" onClick={async () => {
              const ok = await copierTexte(texteRapport);
              notifier(ok ? "Rapport copié" : "Impossible de copier automatiquement : sélectionnez le texte.", !ok);
            }}><IcoCopy /> Copier</button>
          </div>
        </Modal>
      )}
    </>
  );
}
