import { useApp } from "../context";
import {
  TYPES, attenduMensuel, chargesMensuelles, estEntree, mouvementsTries, resumeMois,
  salaireDuMoisPaye, situations, soldeCaisse, tachesDuMois,
} from "../lib/calc";
import { fmtDate, fmtFcfa, fmtHa, fmtMois, fmtNombre, moisCourant } from "../lib/format";
import type { Onglet } from "../App";
import { Amount, Empty, Pill, Stat } from "./ui";

export function Dashboard({ aller }: { aller: (o: Onglet, membreId?: string) => void }) {
  const { state } = useApp();
  const mois = moisCourant();
  const solde = soldeCaisse(state);
  const r = resumeMois(state, mois);
  const sits = situations(state).filter((s) => s.membre.actif);
  const enRetard = sits.filter((s) => s.statut === "retard");
  const arrieres = enRetard.reduce((s, x) => s - x.solde, 0);
  const attendu = attenduMensuel(state);
  const charges = chargesMensuelles(state);
  const derniers = mouvementsTries(state).slice(-6).reverse();
  const manoeuvres = state.manoeuvres.filter((w) => w.actif);
  const max = Math.max(attendu, charges, 1);
  const nomMembre = (id?: string) => state.membres.find((m) => m.id === id)?.nom;

  return (
    <>
      <div className="grid-stats">
        <Stat hero label="Solde en caisse" value={fmtFcfa(solde)} hint={`au ${fmtDate(new Date().toISOString().slice(0, 10))}`} />
        <Stat label={`Entrées ${fmtMois(mois)}`} value={<span className="amount">{fmtNombre(r.entrees)}</span>} hint={`${r.mouvements.filter((v) => estEntree(v.type)).length} opération(s)`} />
        <Stat label={`Sorties ${fmtMois(mois)}`} value={<span className="amount">{fmtNombre(r.sorties)}</span>} hint={`${r.mouvements.filter((v) => !estEntree(v.type)).length} opération(s)`} />
        <Stat label="Arriérés de cotisation" value={<span className={`amount ${arrieres > 0 ? "neg" : ""}`}>{fmtNombre(arrieres)}</span>}
          hint={enRetard.length ? `${enRetard.length} membre(s) en retard` : "Tous les membres sont à jour"} />
      </div>

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <h3>Membres</h3>
            <button type="button" className="btn ghost sm" onClick={() => aller("membres")}>Tout voir</button>
          </div>
          {sits.length === 0 ? <Empty>Aucun membre. Ajoutez-les dans l'onglet Membres.</Empty> : (
            <div className="list">
              {sits.map((s) => (
                <button type="button" key={s.membre.id} className="list-item" style={{ background: "none", border: 0, borderBottom: "1px solid var(--line)", textAlign: "left", cursor: "pointer", width: "100%" }}
                  onClick={() => aller("membres", s.membre.id)}>
                  <div className="grow">
                    <div className="title">{s.membre.nom}</div>
                    <div className="meta">{fmtHa(s.membre.superficie)} · {fmtFcfa(s.cotisation)}/mois</div>
                  </div>
                  <StatutPill s={s} />
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h3>Manœuvre — {fmtMois(mois)}</h3>
            <button type="button" className="btn ghost sm" onClick={() => aller("manoeuvre")}>Planning</button>
          </div>
          {manoeuvres.length === 0 ? <Empty>Aucun manœuvre en poste.</Empty> : manoeuvres.map((w) => {
            const taches = tachesDuMois(state, w.id, mois);
            const faites = taches.filter((t) => t.statut === "fait").length;
            const paye = salaireDuMoisPaye(state, w.id, mois);
            return (
              <div key={w.id} className="list-item" style={{ alignItems: "stretch", flexDirection: "column", gap: 8 }}>
                <div className="row" style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <div><span className="title">{w.nom}</span> <span className="muted small">· {fmtFcfa(w.salaireMensuel)}/mois</span></div>
                  {paye >= w.salaireMensuel ? <Pill kind="good">Salaire payé</Pill>
                    : paye > 0 ? <Pill kind="warn">Payé {fmtNombre(paye)}</Pill>
                    : <Pill kind="neutral">Salaire à payer</Pill>}
                </div>
                <div className="progress" aria-label={`${faites} tâches faites sur ${taches.length}`}>
                  <span style={{ width: `${taches.length ? (faites / taches.length) * 100 : 0}%` }} />
                </div>
                <div className="small muted">{taches.length ? `${faites} tâche(s) faite(s) sur ${taches.length} planifiée(s)` : "Aucune tâche planifiée ce mois-ci"}</div>
              </div>
            );
          })}
        </section>

        <section className="card">
          <h3>Équilibre mensuel</h3>
          <p className="small muted">Cotisations attendues chaque mois face aux charges fixes (salaires).</p>
          <div className="bar-row">
            <span>Cotisations</span>
            <div className="bar"><span style={{ width: `${(attendu / max) * 100}%` }} /></div>
            <span className="amount">{fmtNombre(attendu)}</span>
          </div>
          <div className="bar-row">
            <span>Charges</span>
            <div className="bar"><span className={charges > attendu ? "bad" : "warn"} style={{ width: `${(charges / max) * 100}%` }} /></div>
            <span className="amount">{fmtNombre(charges)}</span>
          </div>
          <p className="small">
            {attendu >= charges
              ? <>Excédent théorique de <strong className="amount">{fmtFcfa(attendu - charges)}</strong> par mois si tout le monde cotise.</>
              : <>Déficit de <strong className="amount neg">{fmtFcfa(charges - attendu)}</strong> par mois : les cotisations ne couvrent pas les charges.</>}
          </p>
        </section>

        <section className="card">
          <div className="card-head">
            <h3>Derniers mouvements</h3>
            <button type="button" className="btn ghost sm" onClick={() => aller("caisse")}>Registre</button>
          </div>
          {derniers.length === 0 ? <Empty>Aucun mouvement enregistré.</Empty> : (
            <div className="list">
              {derniers.map((v) => (
                <div key={v.id} className="list-item">
                  <div className="grow">
                    <div className="title">{v.libelle}</div>
                    <div className="meta">{fmtDate(v.date)} · {TYPES[v.type].label}{nomMembre(v.membreId) && v.type !== "cotisation" ? ` · ${nomMembre(v.membreId)}` : ""}</div>
                  </div>
                  <Amount n={estEntree(v.type) ? v.montant : -v.montant} signed className={estEntree(v.type) ? "in" : "out"} />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

export function StatutPill({ s }: { s: { statut: "a_jour" | "retard" | "avance"; solde: number; moisRetard: number } }) {
  if (s.statut === "a_jour") return <Pill kind="good">À jour</Pill>;
  if (s.statut === "avance") return <Pill kind="good">Avance {fmtNombre(s.solde)}</Pill>;
  return <Pill kind={s.moisRetard >= 2 ? "bad" : "warn"}>Reste {fmtNombre(-s.solde)}</Pill>;
}
