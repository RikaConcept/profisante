import { useMemo, useState } from "react";
import { useApp } from "../context";
import { cotisationMensuelle, partAppel, situationMembre, situations } from "../lib/calc";
import { ajouterMois, fmtFcfa, fmtHa, fmtMois, fmtNombre, moisCourant } from "../lib/format";
import { declarerPaiement, membreMemorise, memoriserMembre } from "../storage";
import type { Membre, Mouvement } from "../types";
import { copierTexte } from "./Caisse";
import { StatutPill } from "./Dashboard";
import { MouvementForm } from "./forms";
import { Amount, Empty, Field, IcoCopy, Modal, Pill } from "./ui";
import { Validations } from "./Validations";
import { fmtDate, fmtMoisCourt } from "../lib/format";

/** Décomposition de ce qu'un membre doit régler aujourd'hui. */
export function chargesEnCours(m: Membre, state: ReturnType<typeof useApp>["state"]) {
  const mois = moisCourant();
  const s = situationMembre(m, state, mois);
  const cotisation = cotisationMensuelle(m, state.settings);
  const appelsMois = state.appels.filter((a) => a.mois === mois).map((a) => ({ appel: a, part: partAppel(a, m, state.membres) }));
  const totalAppelsMois = appelsMois.reduce((x, a) => x + a.part, 0);
  const total = Math.max(0, -s.solde);
  const reporte = -s.solde - cotisation - totalAppelsMois;
  return { mois, situation: s, cotisation, appelsMois, reporte, total };
}

function formatNumero(n: string): string {
  const chiffres = n.replace(/\D/g, "");
  return chiffres.replace(/(\d{2})(?=\d)/g, "$1 ").trim() || n;
}

export function Payer({ onEncaisser }: { onEncaisser?: (membreId: string) => void }) {
  const { state, lectureSeule, notifier, commit, mode, remplacerEtat } = useApp();
  const [envoi, setEnvoi] = useState(false);
  const actifs = state.membres.filter((m) => m.actif);
  const [membreId, setMembreId] = useState<string>(() => {
    const memo = membreMemorise();
    return memo && actifs.some((m) => m.id === memo) ? memo : "";
  });
  const [moyen, setMoyen] = useState("Orange Money");
  const [montant, setMontant] = useState<number | "">("");
  const [encaisser, setEncaisser] = useState<Membre | null>(null);
  const membre = actifs.find((m) => m.id === membreId);
  const charges = useMemo(() => (membre ? chargesEnCours(membre, state) : null), [membre, state]);
  const p = state.settings.paiement;
  const moisPrec = ajouterMois(moisCourant(), -1);

  const montantEffectif = montant === "" ? (charges?.total ?? 0) : montant;
  const message = membre
    ? `Bonjour${p.tresorier ? ` ${p.tresorier}` : ""}, je viens de payer ${fmtNombre(montantEffectif)} FCFA par ${moyen} pour la plantation (${fmtMois(moisCourant()).toLowerCase()}). — ${membre.nom}`
    : "";
  const lienWhatsapp = p.whatsapp ? `https://wa.me/${p.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(message)}` : "";

  async function declarer() {
    if (!membre || montantEffectif <= 0) return;
    setEnvoi(true);
    const r = await declarerPaiement({ membreId: membre.id, montant: montantEffectif, moyen, mois: moisCourant() });
    setEnvoi(false);
    if (r.ok) {
      remplacerEtat(r.etat);
      setMontant("");
      notifier("Paiement déclaré : le trésorier va le valider.");
    } else {
      notifier(r.message, true);
    }
  }

  const mesDeclarations = membre
    ? [...state.declarations].filter((d) => d.membreId === membre.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)
    : [];

  async function enregistrerEncaissement(v: Mouvement) {
    setEncaisser(null);
    await commit({ ...state, mouvements: [...state.mouvements, v] }, "Paiement enregistré");
  }

  return (
    <>
      <div className="section-head">
        <div>
          <h2>Payer mes charges</h2>
          <p className="sub">Ce que chaque membre doit régler ce mois-ci, et comment le régler. La caisse et votre situation se mettent à jour dès que le trésorier enregistre votre paiement.</p>
        </div>
      </div>

      {actifs.length === 0 ? <Empty>Aucun membre actif.</Empty> : (
        <div className="grid-2">
          <section className="card raised">
            <Field label="Je suis">
              <select value={membreId} onChange={(e) => { setMembreId(e.target.value); memoriserMembre(e.target.value); setMontant(""); }}>
                <option value="">Choisir mon nom…</option>
                {actifs.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
              </select>
            </Field>

            {membre && charges && (
              <>
                <div className="stat hero">
                  <div className="label">Total à régler aujourd'hui</div>
                  <div className="value">{fmtFcfa(charges.total)}</div>
                  <div className="hint">{charges.total === 0 ? "Vous êtes à jour, merci !" : `${membre.nom} · ${fmtHa(membre.superficie)}`}</div>
                </div>
                <div className="table-wrap">
                  <table className="ledger">
                    <tbody>
                      <tr><td>Cotisation de {fmtMois(charges.mois).toLowerCase()}</td><td className="num"><Amount n={charges.cotisation} /></td></tr>
                      {charges.appelsMois.map((a) => (
                        <tr key={a.appel.id}><td>{a.appel.titre} <span className="cell-sub">appel de fonds, part au prorata</span></td><td className="num"><Amount n={a.part} /></td></tr>
                      ))}
                      <tr>
                        <td>{charges.reporte >= 0 ? "Arriérés reportés" : "Avance déjà versée"} <span className="cell-sub">situation à fin {fmtMois(moisPrec).toLowerCase()}, appels compris</span></td>
                        <td className="num"><Amount n={charges.reporte >= 0 ? charges.reporte : -charges.reporte} className={charges.reporte > 0 ? "neg" : charges.reporte < 0 ? "in" : ""} /></td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr><td>Total</td><td className="num"><Amount n={charges.total} /></td></tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}
          </section>

          <section className="card">
            <h3>Comment payer</h3>
            <div className="list">
              <div className="list-item">
                <div className="grow">
                  <div className="title">{p.moyens || "Mobile Money"}</div>
                  <div className="amount" style={{ fontSize: "1.25rem", fontWeight: 500 }}>{formatNumero(p.numero)}</div>
                  <div className="meta">Numéro à créditer{p.tresorier ? ` (${p.tresorier})` : ""}</div>
                </div>
                <button type="button" className="btn sm" onClick={async () => notifier((await copierTexte(p.numero)) ? "Numéro copié" : "Copie impossible", false)}><IcoCopy /> Copier</button>
              </div>
              <div className="list-item">
                <div className="grow">
                  <div className="title">Espèces</div>
                  <div className="meta">En main propre au trésorier{p.tresorier ? ` (${p.tresorier})` : ""}, contre enregistrement dans la caisse.</div>
                </div>
              </div>
            </div>

            {membre && (
              <>
                <div className="eyebrow" style={{ marginTop: 4 }}>Après avoir payé, prévenez le trésorier</div>
                <div className="form-grid">
                  <Field label="Montant payé">
                    <div className="suffix">
                      <input type="number" inputMode="numeric" min={0} value={montant === "" ? (charges?.total ?? "") : montant}
                        onChange={(e) => setMontant(e.target.value === "" ? "" : Math.max(0, Math.round(Number(e.target.value))))} />
                    </div>
                  </Field>
                  <Field label="Moyen utilisé">
                    <select value={moyen} onChange={(e) => setMoyen(e.target.value)}>
                      <option>Orange Money</option>
                      <option>Wave</option>
                      <option>Espèces</option>
                      <option>Virement</option>
                    </select>
                  </Field>
                </div>
                <div className="btn-row">
                  {mode === "server" && (
                    <button type="button" className="btn primary" onClick={declarer} disabled={envoi || montantEffectif <= 0}>
                      {envoi ? "Envoi…" : "Déclarer mon paiement"}
                    </button>
                  )}
                  {lienWhatsapp && (
                    <a className={`btn ${mode === "server" ? "" : "primary"}`} href={lienWhatsapp} target="_blank" rel="noopener noreferrer">Envoyer sur WhatsApp</a>
                  )}
                  <button type="button" className="btn" onClick={async () => notifier((await copierTexte(message)) ? "Message copié" : "Copie impossible", false)}><IcoCopy /> Copier le message</button>
                </div>
                <p className="tiny muted">{mode === "server" ? "La déclaration apparaît chez le trésorier, qui la valide après vérification : votre situation et la caisse sont alors mises à jour." : message}</p>
                {mesDeclarations.length > 0 && (
                  <div className="list">
                    <div className="eyebrow" style={{ paddingTop: 6 }}>Mes déclarations</div>
                    {mesDeclarations.map((d) => (
                      <div key={d.id} className="list-item" style={{ padding: "6px 0" }}>
                        <div className="grow">
                          <span className="amount">{fmtNombre(d.montant)}</span> <span className="muted small">· {d.moyen} · {fmtMoisCourt(d.mois)} · {fmtDate(d.date)}</span>
                        </div>
                        {d.statut === "validee" ? <Pill kind="good">Validée</Pill> : d.statut === "refusee" ? <Pill kind="bad">Refusée</Pill> : <Pill kind="warn">En attente</Pill>}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}

      <Validations />

      <section className="card">
        <div className="card-head">
          <h3>Charges en cours — {fmtMois(moisCourant())}</h3>
          <span className="small muted">Visible par tous les membres</span>
        </div>
        <div className="table-wrap">
          <table className="ledger">
            <thead>
              <tr>
                <th>Membre</th>
                <th className="num">Cotisation du mois</th>
                <th className="num">Reporté</th>
                <th className="num">Total à régler</th>
                <th>Situation</th>
                {!lectureSeule && <th />}
              </tr>
            </thead>
            <tbody>
              {situations(state).filter((s) => s.membre.actif).map((s) => {
                const c = chargesEnCours(s.membre, state);
                return (
                  <tr key={s.membre.id}>
                    <td><span className="cell-main">{s.membre.nom}</span><span className="cell-sub">{fmtHa(s.membre.superficie)}</span></td>
                    <td className="num"><Amount n={c.cotisation} /></td>
                    <td className="num"><Amount n={c.reporte} signed className={c.reporte > 0 ? "neg" : c.reporte < 0 ? "in" : ""} /></td>
                    <td className="num"><strong><Amount n={c.total} /></strong></td>
                    <td>{c.total === 0 ? <Pill kind="good">À jour</Pill> : <StatutPill s={s} />}</td>
                    {!lectureSeule && (
                      <td className="num">
                        <button type="button" className="btn sm" onClick={() => (onEncaisser ? onEncaisser(s.membre.id) : setEncaisser(s.membre))}>Encaisser</button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="tiny muted">« Reporté » : arriérés (+) ou avance (−) constatés à fin {fmtMois(moisPrec).toLowerCase()}. Chaque paiement enregistré par le trésorier met à jour ces montants, la caisse et les rapports.</p>
      </section>

      {encaisser && (
        <Modal titre={`Encaisser — ${encaisser.nom}`} onClose={() => setEncaisser(null)}>
          <MouvementForm onSubmit={enregistrerEncaissement} onCancel={() => setEncaisser(null)}
            defaults={{ type: "cotisation", membreId: encaisser.id, montant: chargesEnCours(encaisser, state).total || cotisationMensuelle(encaisser, state.settings) }} />
        </Modal>
      )}
    </>
  );
}
