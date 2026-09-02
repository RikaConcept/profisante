import { useState } from "react";
import { useApp } from "../context";
import { moisDisponibles, salaireDuMoisPaye, salairesVerses, tachesDuMois } from "../lib/calc";
import { ajouterMois, fmtDate, fmtFcfa, fmtMois, fmtMoisCourt, fmtNombre, moisCourant } from "../lib/format";
import { nouvelId } from "../lib/id";
import type { Manoeuvre as ManoeuvreT, Mouvement, StatutTache, Tache } from "../types";
import { ManoeuvreForm, MouvementForm, TacheForm } from "./forms";
import { Amount, ConsultationHint, Empty, IcoCheck, IcoPlus, IcoX, Modal, Pill, Stat } from "./ui";

type Modale =
  | null
  | { mode: "nouveau-manoeuvre" }
  | { mode: "edition-manoeuvre"; manoeuvre: ManoeuvreT }
  | { mode: "nouvelle-tache" }
  | { mode: "edition-tache"; tache: Tache }
  | { mode: "salaire"; manoeuvre: ManoeuvreT }
  | { mode: "mouvement"; mouvement: Mouvement };

const CYCLE: Record<StatutTache, StatutTache> = { prevu: "fait", fait: "non_fait", non_fait: "prevu" };
const LIBELLE: Record<StatutTache, string> = { prevu: "Prévue", fait: "Faite", non_fait: "Non faite" };

export function Manoeuvre() {
  const { state, commit, lectureSeule, enregistrement } = useApp();
  const [mois, setMois] = useState(moisCourant());
  const [wId, setWId] = useState(state.manoeuvres.find((w) => w.actif)?.id ?? state.manoeuvres[0]?.id ?? "");
  const [modale, setModale] = useState<Modale>(null);
  const [pending, setPending] = useState<Record<string, StatutTache>>({});

  const w = state.manoeuvres.find((x) => x.id === wId);
  const moisListe = moisDisponibles(state);
  if (!moisListe.includes(mois)) moisListe.unshift(mois);
  const moisSuivant = ajouterMois(moisCourant(), 1);
  if (!moisListe.includes(moisSuivant)) moisListe.unshift(moisSuivant);

  async function enregistrerManoeuvre(m: ManoeuvreT) {
    const existe = state.manoeuvres.some((x) => x.id === m.id);
    setModale(null);
    if (!existe) setWId(m.id);
    await commit({ ...state, manoeuvres: existe ? state.manoeuvres.map((x) => (x.id === m.id ? m : x)) : [...state.manoeuvres, m] },
      existe ? "Manœuvre modifié" : "Manœuvre ajouté");
  }

  async function supprimerManoeuvre(m: ManoeuvreT) {
    const n = state.mouvements.filter((v) => v.manoeuvreId === m.id).length;
    if (n > 0) {
      window.alert(`${m.nom} a ${n} salaire(s) enregistré(s). Passez-le plutôt en « plus en poste » pour garder l'historique.`);
      return;
    }
    if (!window.confirm(`Supprimer ${m.nom} et ses tâches ?`)) return;
    setModale(null);
    await commit({ ...state, manoeuvres: state.manoeuvres.filter((x) => x.id !== m.id), taches: state.taches.filter((t) => t.manoeuvreId !== m.id) }, "Manœuvre supprimé");
  }

  async function enregistrerTache(t: Tache) {
    const existe = state.taches.some((x) => x.id === t.id);
    setModale(null);
    await commit({ ...state, taches: existe ? state.taches.map((x) => (x.id === t.id ? t : x)) : [...state.taches, t] },
      existe ? "Tâche modifiée" : "Tâche ajoutée");
  }

  async function supprimerTache(t: Tache) {
    if (!window.confirm(`Supprimer « ${t.titre} » ?`)) return;
    setModale(null);
    await commit({ ...state, taches: state.taches.filter((x) => x.id !== t.id) }, "Tâche supprimée");
  }

  async function enregistrerMouvement(v: Mouvement) {
    const existe = state.mouvements.some((x) => x.id === v.id);
    setModale(null);
    await commit({ ...state, mouvements: existe ? state.mouvements.map((x) => (x.id === v.id ? v : x)) : [...state.mouvements, v] },
      existe ? "Salaire modifié" : "Salaire enregistré");
  }

  async function supprimerMouvement(v: Mouvement) {
    if (!window.confirm(`Supprimer ce paiement de ${fmtFcfa(v.montant)} ?`)) return;
    setModale(null);
    await commit({ ...state, mouvements: state.mouvements.filter((x) => x.id !== v.id) }, "Paiement supprimé");
  }

  function basculer(t: Tache) {
    if (lectureSeule) return;
    const courant = pending[t.id] ?? t.statut;
    const suivant = CYCLE[courant];
    setPending((p) => {
      const n = { ...p };
      if (suivant === t.statut) delete n[t.id];
      else n[t.id] = suivant;
      return n;
    });
  }

  async function enregistrerPlanning() {
    const taches = state.taches.map((t) => (pending[t.id] ? { ...t, statut: pending[t.id] } : t));
    const n = Object.keys(pending).length;
    setPending({});
    await commit({ ...state, taches }, `Planning mis à jour (${n} tâche${n > 1 ? "s" : ""})`);
  }

  async function copierMoisPrecedent() {
    if (!w) return;
    const prec = ajouterMois(mois, -1);
    const source = tachesDuMois(state, w.id, prec);
    if (!source.length) return window.alert(`Aucune tâche en ${fmtMois(prec).toLowerCase()} à recopier.`);
    const copies: Tache[] = source.map((t) => ({ ...t, id: nouvelId("t"), mois, statut: "prevu" }));
    await commit({ ...state, taches: [...state.taches, ...copies] }, `${copies.length} tâche(s) recopiée(s) depuis ${fmtMois(prec).toLowerCase()}`);
  }

  const nbPending = Object.keys(pending).length;

  return (
    <>
      <div className="section-head">
        <div>
          <h2>Manœuvre</h2>
          <p className="sub">Salaire mensuel et planning des tâches à exécuter dans la plantation.</p>
        </div>
        {!lectureSeule && (
          <div className="btn-row">
            {w && <button type="button" className="btn" onClick={() => setModale({ mode: "edition-manoeuvre", manoeuvre: w })}>Modifier</button>}
            <button type="button" className="btn" onClick={() => setModale({ mode: "nouveau-manoeuvre" })}><IcoPlus /> Manœuvre</button>
          </div>
        )}
      </div>

      {lectureSeule && <ConsultationHint action="Pour payer le salaire ou mettre à jour le planning, activez le mode trésorier." />}

      {!w ? <Empty>Aucun manœuvre enregistré.</Empty> : (
        <>
          <div className="toolbar">
            {state.manoeuvres.length > 1 && (
              <select value={wId} onChange={(e) => { setWId(e.target.value); setPending({}); }} aria-label="Manœuvre">
                {state.manoeuvres.map((x) => <option key={x.id} value={x.id}>{x.nom}{x.actif ? "" : " (plus en poste)"}</option>)}
              </select>
            )}
            <select value={mois} onChange={(e) => { setMois(e.target.value); setPending({}); }} aria-label="Mois">
              {moisListe.map((m) => <option key={m} value={m}>{fmtMois(m)}</option>)}
            </select>
          </div>

          {(() => {
            const taches = tachesDuMois(state, w.id, mois);
            const etat = (t: Tache) => pending[t.id] ?? t.statut;
            const faites = taches.filter((t) => etat(t) === "fait").length;
            const nonFaites = taches.filter((t) => etat(t) === "non_fait").length;
            const paye = salaireDuMoisPaye(state, w.id, mois);
            const reste = Math.max(0, w.salaireMensuel - paye);
            const semaines = [...new Set(taches.map((t) => t.semaine ?? 0))].sort((a, b) => (a || 9) - (b || 9));
            return (
              <>
                <div className="grid-stats">
                  <Stat label={`${w.nom} · salaire`} value={<span className="amount">{fmtNombre(w.salaireMensuel)}</span>} hint={w.actif ? (w.telephone ?? "en poste") : "plus en poste"} />
                  <Stat label={`Payé pour ${fmtMoisCourt(mois)}`} value={<span className={`amount ${paye ? "in" : ""}`}>{fmtNombre(paye)}</span>}
                    hint={reste === 0 ? <Pill kind="good">Salaire réglé</Pill> : <Pill kind={paye ? "warn" : "neutral"}>Reste {fmtNombre(reste)}</Pill>} />
                  <Stat label="Tâches du mois" value={`${faites} / ${taches.length}`} hint={nonFaites ? `${nonFaites} non faite(s)` : faites === taches.length && taches.length ? "Tout est fait" : "faites"} />
                </div>

                <section className="card">
                  <div className="card-head">
                    <h3>Planning — {fmtMois(mois)}</h3>
                    {!lectureSeule && (
                      <div className="btn-row">
                        {taches.length === 0 && <button type="button" className="btn sm" onClick={copierMoisPrecedent} disabled={enregistrement}>Recopier le mois précédent</button>}
                        <button type="button" className="btn sm" onClick={() => setModale({ mode: "nouvelle-tache" })}><IcoPlus /> Tâche</button>
                        {reste > 0 && <button type="button" className="btn primary sm" onClick={() => setModale({ mode: "salaire", manoeuvre: w })}>Payer le salaire</button>}
                      </div>
                    )}
                  </div>
                  {taches.length > 0 && (
                    <div className="progress"><span style={{ width: `${(faites / taches.length) * 100}%` }} /></div>
                  )}
                  {taches.length === 0 ? <Empty>Aucune tâche planifiée pour {fmtMois(mois).toLowerCase()}.</Empty> : (
                    <div className="list">
                      {semaines.map((s) => (
                        <div key={s}>
                          <div className="eyebrow" style={{ padding: "10px 0 2px" }}>{s ? `Semaine ${s}` : "Sans semaine précise"}</div>
                          {taches.filter((t) => (t.semaine ?? 0) === s).map((t) => {
                            const st = etat(t);
                            return (
                              <div key={t.id} className="list-item">
                                <button type="button" className={`task-check ${st}`} onClick={() => basculer(t)} disabled={lectureSeule}
                                  aria-label={`${t.titre} : ${LIBELLE[st]}. Cliquer pour changer.`} title={LIBELLE[st]}>
                                  {st === "fait" && <IcoCheck />}
                                  {st === "non_fait" && <IcoX />}
                                </button>
                                <div className="grow" style={{ cursor: lectureSeule ? "default" : "pointer" }} onClick={() => !lectureSeule && setModale({ mode: "edition-tache", tache: t })}>
                                  <div className="title" style={{ textDecoration: st === "fait" ? "line-through" : "none", opacity: st === "fait" ? 0.7 : 1 }}>{t.titre}</div>
                                  {t.detail && <div className="meta">{t.detail}</div>}
                                </div>
                                {pending[t.id] && <span className="pill plain">modifié</span>}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                  {!lectureSeule && (
                    <p className="tiny muted">Cliquez sur la case pour passer une tâche à « faite », puis « non faite », puis « prévue ».</p>
                  )}
                  {nbPending > 0 && (
                    <div className="btn-row end">
                      <button type="button" className="btn" onClick={() => setPending({})} disabled={enregistrement}>Annuler</button>
                      <button type="button" className="btn primary" onClick={enregistrerPlanning} disabled={enregistrement}>
                        {enregistrement ? "Enregistrement…" : `Enregistrer le planning (${nbPending})`}
                      </button>
                    </div>
                  )}
                </section>
              </>
            );
          })()}

          <section className="card">
            <h3>Salaires versés</h3>
            {salairesVerses(state, w.id).length === 0 ? <Empty>Aucun salaire enregistré.</Empty> : (
              <div className="table-wrap">
                <table className="ledger">
                  <thead><tr><th>Date</th><th>Mois</th><th>Libellé</th><th className="num">Montant</th></tr></thead>
                  <tbody>
                    {salairesVerses(state, w.id).map((v) => (
                      <tr key={v.id} className={lectureSeule ? "" : "clickable"} onClick={() => !lectureSeule && setModale({ mode: "mouvement", mouvement: v })}>
                        <td style={{ whiteSpace: "nowrap" }}>{fmtDate(v.date)}</td>
                        <td style={{ whiteSpace: "nowrap" }}>{fmtMoisCourt(v.mois)}</td>
                        <td>{v.libelle}{v.note && <span className="cell-sub">{v.note}</span>}</td>
                        <td className="num"><Amount n={v.montant} className="out" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {modale?.mode === "nouveau-manoeuvre" && (
        <Modal titre="Nouveau manœuvre" onClose={() => setModale(null)}>
          <ManoeuvreForm onSubmit={enregistrerManoeuvre} onCancel={() => setModale(null)} />
        </Modal>
      )}
      {modale?.mode === "edition-manoeuvre" && (
        <Modal titre={`Modifier ${modale.manoeuvre.nom}`} onClose={() => setModale(null)}>
          <ManoeuvreForm initial={modale.manoeuvre} onSubmit={enregistrerManoeuvre} onCancel={() => setModale(null)} onDelete={() => supprimerManoeuvre(modale.manoeuvre)} />
        </Modal>
      )}
      {modale?.mode === "nouvelle-tache" && w && (
        <Modal titre="Nouvelle tâche" onClose={() => setModale(null)}>
          <TacheForm defaults={{ mois, manoeuvreId: w.id }} onSubmit={enregistrerTache} onCancel={() => setModale(null)} />
        </Modal>
      )}
      {modale?.mode === "edition-tache" && (
        <Modal titre="Modifier la tâche" onClose={() => setModale(null)}>
          <TacheForm initial={modale.tache} onSubmit={enregistrerTache} onCancel={() => setModale(null)} onDelete={() => supprimerTache(modale.tache)} />
        </Modal>
      )}
      {modale?.mode === "salaire" && (
        <Modal titre={`Salaire — ${modale.manoeuvre.nom}`} onClose={() => setModale(null)}>
          <MouvementForm onSubmit={enregistrerMouvement} onCancel={() => setModale(null)}
            defaults={{ type: "salaire", manoeuvreId: modale.manoeuvre.id, mois, montant: Math.max(0, modale.manoeuvre.salaireMensuel - salaireDuMoisPaye(state, modale.manoeuvre.id, mois)) || modale.manoeuvre.salaireMensuel }} />
        </Modal>
      )}
      {modale?.mode === "mouvement" && (
        <Modal titre="Modifier le paiement" onClose={() => setModale(null)}>
          <MouvementForm initial={modale.mouvement} onSubmit={enregistrerMouvement} onCancel={() => setModale(null)} onDelete={() => supprimerMouvement(modale.mouvement)} />
        </Modal>
      )}
    </>
  );
}
