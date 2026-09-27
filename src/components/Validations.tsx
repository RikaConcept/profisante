import { useApp } from "../context";
import { fmtDate, fmtFcfa, fmtMoisCourt, fmtNombre } from "../lib/format";
import { nouvelId } from "../lib/id";
import type { Declaration, Mouvement } from "../types";
import { Amount, Empty, IcoCheck, IcoX, Pill } from "./ui";

/** Déclarations de paiement en attente, à valider ou refuser par le trésorier. */
export function Validations({ compact }: { compact?: boolean }) {
  const { state, commit, lectureSeule, enregistrement } = useApp();
  const enAttente = state.declarations
    .filter((d) => d.statut === "en_attente")
    .sort((a, b) => a.date.localeCompare(b.date));
  const nomMembre = (id: string) => state.membres.find((m) => m.id === id)?.nom ?? "Membre inconnu";

  if (lectureSeule) return null;
  if (enAttente.length === 0) {
    return compact ? null : <Empty>Aucune déclaration de paiement en attente.</Empty>;
  }

  async function valider(d: Declaration) {
    const membre = state.membres.find((m) => m.id === d.membreId);
    const v: Mouvement = {
      id: nouvelId("v"),
      date: d.date,
      mois: d.mois,
      type: "cotisation",
      montant: d.montant,
      libelle: `Cotisation ${membre?.nom ?? ""}`.trim(),
      membreId: d.membreId,
      note: [d.moyen, d.note].filter(Boolean).join(" · ") || undefined,
    };
    await commit({
      ...state,
      mouvements: [...state.mouvements, v],
      declarations: state.declarations.map((x) => (x.id === d.id ? { ...x, statut: "validee", mouvementId: v.id } : x)),
    }, `Paiement de ${nomMembre(d.membreId)} validé`);
  }

  async function refuser(d: Declaration) {
    if (!window.confirm(`Refuser la déclaration de ${nomMembre(d.membreId)} (${fmtFcfa(d.montant)}) ? Le membre verra « refusée ».`)) return;
    await commit({
      ...state,
      declarations: state.declarations.map((x) => (x.id === d.id ? { ...x, statut: "refusee" } : x)),
    }, "Déclaration refusée");
  }

  return (
    <section className="card" style={{ borderColor: "var(--warn)" }}>
      <div className="card-head">
        <h3>À valider <Pill kind="warn">{enAttente.length}</Pill></h3>
        <span className="small muted">Paiements annoncés par les membres</span>
      </div>
      <div className="list">
        {enAttente.map((d) => (
          <div key={d.id} className="list-item">
            <div className="grow">
              <div className="title">{nomMembre(d.membreId)} · <Amount n={d.montant} className="in" /></div>
              <div className="meta">{d.moyen} · pour {fmtMoisCourt(d.mois)} · déclaré le {fmtDate(d.date)}{d.note ? ` · ${d.note}` : ""}</div>
            </div>
            <div className="btn-row" style={{ flexWrap: "nowrap" }}>
              <button type="button" className="btn sm danger" onClick={() => refuser(d)} disabled={enregistrement} title="Refuser"><IcoX /></button>
              <button type="button" className="btn sm primary" onClick={() => valider(d)} disabled={enregistrement}><IcoCheck /> Valider</button>
            </div>
          </div>
        ))}
      </div>
      <p className="tiny muted">Valider crée l'encaissement dans la caisse ({fmtNombre(enAttente.reduce((s, d) => s + d.montant, 0))} FCFA au total) et met à jour la situation du membre.</p>
    </section>
  );
}
