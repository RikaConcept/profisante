import { useEffect, useState } from "react";
import { useApp } from "../context";
import { attenduMensuel, mouvementsTries, situationMembre, situations, superficieTotale } from "../lib/calc";
import { fmtDate, fmtFcfa, fmtHa, fmtMois, fmtMoisCourt, fmtNombre, moisCourant } from "../lib/format";
import type { Membre, Mouvement } from "../types";
import { StatutPill } from "./Dashboard";
import { MembreForm, MouvementForm } from "./forms";
import { Amount, Empty, IcoBack, IcoPlus, Modal, Stat } from "./ui";

type Modale =
  | null
  | { mode: "nouveau" }
  | { mode: "edition"; membre: Membre }
  | { mode: "paiement"; membre: Membre }
  | { mode: "mouvement"; mouvement: Mouvement };

export function Membres({ selection, onSelection }: { selection?: string; onSelection: (id?: string) => void }) {
  const { state, commit, lectureSeule } = useApp();
  const [modale, setModale] = useState<Modale>(null);
  const [sel, setSel] = useState<string | undefined>(selection);
  useEffect(() => setSel(selection), [selection]);

  const choisir = (id?: string) => { setSel(id); onSelection(id); };

  async function enregistrerMembre(m: Membre) {
    const existe = state.membres.some((x) => x.id === m.id);
    setModale(null);
    await commit({ ...state, membres: existe ? state.membres.map((x) => (x.id === m.id ? m : x)) : [...state.membres, m] },
      existe ? "Membre modifié" : "Membre ajouté");
  }

  async function supprimerMembre(m: Membre) {
    const n = state.mouvements.filter((v) => v.membreId === m.id).length;
    if (n > 0) {
      window.alert(`${m.nom} a ${n} paiement(s) enregistré(s). Passez-le plutôt en « inactif » pour conserver l'historique.`);
      return;
    }
    if (!window.confirm(`Supprimer ${m.nom} ?`)) return;
    setModale(null);
    choisir(undefined);
    await commit({ ...state, membres: state.membres.filter((x) => x.id !== m.id) }, "Membre supprimé");
  }

  async function enregistrerMouvement(v: Mouvement) {
    const existe = state.mouvements.some((x) => x.id === v.id);
    setModale(null);
    await commit({ ...state, mouvements: existe ? state.mouvements.map((x) => (x.id === v.id ? v : x)) : [...state.mouvements, v] },
      existe ? "Paiement modifié" : "Paiement enregistré");
  }

  async function supprimerMouvement(v: Mouvement) {
    if (!window.confirm(`Supprimer ce paiement de ${fmtFcfa(v.montant)} ?`)) return;
    setModale(null);
    await commit({ ...state, mouvements: state.mouvements.filter((x) => x.id !== v.id) }, "Paiement supprimé");
  }

  const membreSel = state.membres.find((m) => m.id === sel);

  const modales = (
    <>
      {modale?.mode === "nouveau" && (
        <Modal titre="Nouveau membre" onClose={() => setModale(null)}>
          <MembreForm onSubmit={enregistrerMembre} onCancel={() => setModale(null)} />
        </Modal>
      )}
      {modale?.mode === "edition" && (
        <Modal titre={`Modifier ${modale.membre.nom}`} onClose={() => setModale(null)}>
          <MembreForm initial={modale.membre} onSubmit={enregistrerMembre} onCancel={() => setModale(null)} onDelete={() => supprimerMembre(modale.membre)} />
        </Modal>
      )}
      {modale?.mode === "paiement" && (
        <Modal titre={`Encaisser — ${modale.membre.nom}`} onClose={() => setModale(null)}>
          <MouvementForm onSubmit={enregistrerMouvement} onCancel={() => setModale(null)}
            defaults={{ type: "cotisation", membreId: modale.membre.id, montant: situationMembre(modale.membre, state).cotisation }} />
        </Modal>
      )}
      {modale?.mode === "mouvement" && (
        <Modal titre="Modifier le paiement" onClose={() => setModale(null)}>
          <MouvementForm initial={modale.mouvement} onSubmit={enregistrerMouvement} onCancel={() => setModale(null)} onDelete={() => supprimerMouvement(modale.mouvement)} />
        </Modal>
      )}
    </>
  );

  if (membreSel) {
    const s = situationMembre(membreSel, state);
    const paiements = mouvementsTries(state).filter((v) => v.membreId === membreSel.id).reverse();
    return (
      <>
        <button type="button" className="detail-back" onClick={() => choisir(undefined)}><IcoBack /> Tous les membres</button>
        <div className="section-head">
          <div>
            <h2>{membreSel.nom} {!membreSel.actif && <span className="pill plain">inactif</span>}</h2>
            <p className="sub">{fmtHa(membreSel.superficie)} · cotisation {fmtFcfa(s.cotisation)} par mois{membreSel.telephone ? ` · ${membreSel.telephone}` : ""}</p>
            {membreSel.note && <p className="small muted">{membreSel.note}</p>}
          </div>
          {!lectureSeule && (
            <div className="btn-row">
              <button type="button" className="btn" onClick={() => setModale({ mode: "edition", membre: membreSel })}>Modifier</button>
              <button type="button" className="btn primary" onClick={() => setModale({ mode: "paiement", membre: membreSel })}><IcoPlus /> Encaisser</button>
            </div>
          )}
        </div>

        <div className="grid-stats">
          <Stat label="Dû depuis le début" value={<span className="amount">{fmtNombre(s.du)}</span>}
            hint={`${s.moisDus.length} mois${s.duAppels ? ` + appels ${fmtNombre(s.duAppels)}` : ""}`} />
          <Stat label="Payé" value={<span className="amount in">{fmtNombre(s.paye)}</span>} hint={`${paiements.length} paiement(s)`} />
          <Stat label={s.solde < 0 ? "Reste à payer" : "Avance"} value={<span className={`amount ${s.solde < 0 ? "neg" : ""}`}>{fmtNombre(Math.abs(s.solde))}</span>}
            hint={<StatutPill s={s} />} />
        </div>

        <div className="grid-2">
          <section className="card">
            <h3>Mois par mois</h3>
            <div className="table-wrap">
              <table className="ledger">
                <thead><tr><th>Mois</th><th className="num">Dû</th><th className="num">Payé</th><th className="num">Écart</th></tr></thead>
                <tbody>
                  {[...s.parMois].reverse().map((l) => {
                    const du = l.duCotisation + l.duAppels;
                    const ecart = l.paye - du;
                    return (
                      <tr key={l.mois}>
                        <td>{fmtMois(l.mois)}{l.mois === moisCourant() ? <span className="cell-sub">en cours</span> : null}</td>
                        <td className="num"><Amount n={du} /></td>
                        <td className="num"><Amount n={l.paye} className={l.paye ? "in" : ""} /></td>
                        <td className="num"><Amount n={ecart} signed /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="tiny muted">L'écart d'un mois compare ce qui était dû pour ce mois à ce qui a été payé « pour » ce mois. Le solde global en haut fait foi.</p>
          </section>

          <section className="card">
            <h3>Paiements</h3>
            {paiements.length === 0 ? <Empty>Aucun paiement enregistré.</Empty> : (
              <div className="table-wrap">
                <table className="ledger">
                  <thead><tr><th>Date</th><th>Pour</th><th>Libellé</th><th className="num">Montant</th></tr></thead>
                  <tbody>
                    {paiements.map((v) => (
                      <tr key={v.id} className={lectureSeule ? "" : "clickable"} onClick={() => !lectureSeule && setModale({ mode: "mouvement", mouvement: v })}>
                        <td style={{ whiteSpace: "nowrap" }}>{fmtDate(v.date)}</td>
                        <td style={{ whiteSpace: "nowrap" }}>{fmtMoisCourt(v.mois)}</td>
                        <td>{v.libelle}{v.note && <span className="cell-sub">{v.note}</span>}</td>
                        <td className="num"><Amount n={v.montant} className="in" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
        {modales}
      </>
    );
  }

  const sits = situations(state);
  const actifs = sits.filter((s) => s.membre.actif);
  const totalDu = actifs.reduce((a, s) => a + s.du, 0);
  const totalPaye = actifs.reduce((a, s) => a + s.paye, 0);

  return (
    <>
      <div className="section-head">
        <div>
          <h2>Membres</h2>
          <p className="sub">
            {actifs.length} membre(s) actif(s) · {fmtHa(superficieTotale(state.membres))} au total · {fmtFcfa(attenduMensuel(state))} attendus par mois
          </p>
        </div>
        {!lectureSeule && <button type="button" className="btn primary" onClick={() => setModale({ mode: "nouveau" })}><IcoPlus /> Membre</button>}
      </div>

      <section className="card">
        {sits.length === 0 ? <Empty>Aucun membre pour l'instant.</Empty> : (
          <div className="table-wrap">
            <table className="ledger">
              <thead>
                <tr>
                  <th>Membre</th>
                  <th className="num">Cotisation / mois</th>
                  <th className="num">Dû</th>
                  <th className="num">Payé</th>
                  <th className="num">Solde</th>
                  <th>Situation</th>
                </tr>
              </thead>
              <tbody>
                {sits.map((s) => (
                  <tr key={s.membre.id} className={`clickable ${s.membre.actif ? "" : "inactive"}`} onClick={() => choisir(s.membre.id)}>
                    <td>
                      <span className="cell-main">{s.membre.nom}</span>
                      <span className="cell-sub">{fmtHa(s.membre.superficie)}{s.membre.actif ? "" : " · inactif"}</span>
                    </td>
                    <td className="num"><Amount n={s.cotisation} /></td>
                    <td className="num"><Amount n={s.du} /></td>
                    <td className="num"><Amount n={s.paye} className={s.paye ? "in" : ""} /></td>
                    <td className="num"><Amount n={s.solde} signed /></td>
                    <td>{s.membre.actif ? <StatutPill s={s} /> : <span className="muted small">—</span>}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total actifs</td>
                  <td className="num"><Amount n={attenduMensuel(state)} /></td>
                  <td className="num"><Amount n={totalDu} /></td>
                  <td className="num"><Amount n={totalPaye} /></td>
                  <td className="num"><Amount n={totalPaye - totalDu} signed /></td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <p className="tiny muted">Cotisation mensuelle = superficie × {fmtFcfa(state.settings.tauxHectare)} par hectare (modifiable dans Réglages), sauf cotisation fixe. Le dû cumule chaque mois depuis {fmtMois(state.settings.debutSuivi).toLowerCase()} plus la part des appels de fonds.</p>
      </section>
      {modales}
    </>
  );
}
