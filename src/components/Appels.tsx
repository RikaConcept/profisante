import { useState } from "react";
import { useApp } from "../context";
import { situationAppel } from "../lib/calc";
import { fmtFcfa, fmtHa, fmtMois, fmtNombre } from "../lib/format";
import type { AppelFonds, Membre, Mouvement } from "../types";
import { AppelForm, MouvementForm } from "./forms";
import { Amount, Empty, IcoPlus, Modal, Pill } from "./ui";

type Modale =
  | null
  | { mode: "nouveau" }
  | { mode: "edition"; appel: AppelFonds }
  | { mode: "paiement"; appel: AppelFonds; membre: Membre; reste: number };

export function Appels() {
  const { state, commit, lectureSeule } = useApp();
  const [modale, setModale] = useState<Modale>(null);
  const appels = [...state.appels].sort((a, b) => b.mois.localeCompare(a.mois));

  async function enregistrer(a: AppelFonds) {
    const existe = state.appels.some((x) => x.id === a.id);
    setModale(null);
    await commit({ ...state, appels: existe ? state.appels.map((x) => (x.id === a.id ? a : x)) : [...state.appels, a] },
      existe ? "Appel de fonds modifié" : "Appel de fonds créé");
  }

  async function supprimer(a: AppelFonds) {
    const n = state.mouvements.filter((v) => v.appelId === a.id).length;
    if (n > 0) return window.alert(`${n} paiement(s) sont rattachés à cet appel. Supprimez-les d'abord dans la caisse.`);
    if (!window.confirm(`Supprimer l'appel « ${a.titre} » ?`)) return;
    setModale(null);
    await commit({ ...state, appels: state.appels.filter((x) => x.id !== a.id) }, "Appel de fonds supprimé");
  }

  async function encaisser(v: Mouvement) {
    setModale(null);
    await commit({ ...state, mouvements: [...state.mouvements, v] }, "Paiement enregistré");
  }

  return (
    <>
      <div className="section-head">
        <div>
          <h2>Appels de fonds</h2>
          <p className="sub">Dépenses exceptionnelles (engrais, matériel, main-d'œuvre supplémentaire…) réparties entre les membres au prorata de leur superficie.</p>
        </div>
        {!lectureSeule && <button type="button" className="btn primary" onClick={() => setModale({ mode: "nouveau" })}><IcoPlus /> Appel de fonds</button>}
      </div>

      {appels.length === 0 ? <Empty>Aucun appel de fonds. Les cotisations mensuelles suffisent pour l'instant.</Empty> : appels.map((a) => {
        const s = situationAppel(a, state);
        const pct = a.montantTotal ? Math.min(100, (s.totalPaye / a.montantTotal) * 100) : 0;
        const complet = s.totalPaye >= a.montantTotal;
        return (
          <section key={a.id} className="card">
            <div className="card-head">
              <div>
                <h3>{a.titre}</h3>
                <div className="small muted">{fmtMois(a.mois)}{a.detail ? ` · ${a.detail}` : ""}</div>
              </div>
              <div className="btn-row">
                {complet ? <Pill kind="good">Réuni</Pill> : <Pill kind="warn">{fmtNombre(s.totalPaye)} / {fmtNombre(a.montantTotal)}</Pill>}
                {!lectureSeule && <button type="button" className="btn sm" onClick={() => setModale({ mode: "edition", appel: a })}>Modifier</button>}
              </div>
            </div>
            <div className="progress"><span style={{ width: `${pct}%` }} /></div>
            <div className="table-wrap">
              <table className="ledger">
                <thead><tr><th>Membre</th><th className="num">Part</th><th className="num">Payé</th><th className="num">Reste</th>{!lectureSeule && <th />}</tr></thead>
                <tbody>
                  {s.parts.map((p) => {
                    const reste = Math.max(0, p.part - p.paye);
                    return (
                      <tr key={p.membre.id}>
                        <td><span className="cell-main">{p.membre.nom}</span><span className="cell-sub">{fmtHa(p.membre.superficie)}</span></td>
                        <td className="num"><Amount n={p.part} /></td>
                        <td className="num"><Amount n={p.paye} className={p.paye ? "in" : ""} /></td>
                        <td className="num">{reste ? <Amount n={reste} className="neg" /> : <Pill kind="good" plain>OK</Pill>}</td>
                        {!lectureSeule && (
                          <td className="num">
                            {reste > 0 && <button type="button" className="btn sm" onClick={() => setModale({ mode: "paiement", appel: a, membre: p.membre, reste })}>Encaisser</button>}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Total</td>
                    <td className="num"><Amount n={s.parts.reduce((x, p) => x + p.part, 0)} /></td>
                    <td className="num"><Amount n={s.totalPaye} /></td>
                    <td className="num"><Amount n={Math.max(0, a.montantTotal - s.totalPaye)} /></td>
                    {!lectureSeule && <td />}
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        );
      })}

      {modale?.mode === "nouveau" && (
        <Modal titre="Nouvel appel de fonds" onClose={() => setModale(null)}>
          <AppelForm onSubmit={enregistrer} onCancel={() => setModale(null)} />
        </Modal>
      )}
      {modale?.mode === "edition" && (
        <Modal titre="Modifier l'appel de fonds" onClose={() => setModale(null)}>
          <AppelForm initial={modale.appel} onSubmit={enregistrer} onCancel={() => setModale(null)} onDelete={() => supprimer(modale.appel)} />
        </Modal>
      )}
      {modale?.mode === "paiement" && (
        <Modal titre={`${modale.appel.titre} — ${modale.membre.nom}`} onClose={() => setModale(null)}>
          <p className="small muted">Reste à payer : {fmtFcfa(modale.reste)}</p>
          <MouvementForm onSubmit={encaisser} onCancel={() => setModale(null)}
            defaults={{ type: "appel", appelId: modale.appel.id, membreId: modale.membre.id, mois: modale.appel.mois, montant: modale.reste }} />
        </Modal>
      )}
    </>
  );
}
