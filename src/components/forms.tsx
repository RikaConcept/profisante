import { useMemo, useState, type FormEvent } from "react";
import { useApp } from "../context";
import { TYPES, TYPES_ENTREE, TYPES_SORTIE, cotisationMensuelle, partAppel, superficieTotale } from "../lib/calc";
import { aujourdhui, fmtFcfa, fmtHa, moisCourant, moisDeDate } from "../lib/format";
import { nouvelId } from "../lib/id";
import type { AppelFonds, Manoeuvre, Membre, Mouvement, StatutTache, Tache, TypeMouvement } from "../types";
import { AmountInput, Field, FormActions, MonthField } from "./ui";

interface FormProps<T> {
  initial?: T;
  defaults?: Partial<T>;
  onSubmit(v: T): void;
  onCancel(): void;
  onDelete?(): void;
}

// ------------------------------------------------------------- mouvement

export function MouvementForm({ initial, defaults, onSubmit, onCancel, onDelete }: FormProps<Mouvement>) {
  const { state, enregistrement } = useApp();
  const d = { ...defaults, ...initial };
  const [type, setType] = useState<TypeMouvement>(d.type ?? "cotisation");
  const [date, setDate] = useState(d.date ?? aujourdhui());
  const [mois, setMois] = useState(d.mois ?? moisDeDate(d.date ?? aujourdhui()));
  const [moisTouche, setMoisTouche] = useState(Boolean(d.mois));
  const [membreId, setMembreId] = useState(d.membreId ?? state.membres.find((m) => m.actif)?.id ?? "");
  const [manoeuvreId, setManoeuvreId] = useState(d.manoeuvreId ?? state.manoeuvres.find((w) => w.actif)?.id ?? "");
  const [appelId, setAppelId] = useState(d.appelId ?? state.appels[0]?.id ?? "");
  const [montant, setMontant] = useState<number | "">(d.montant ?? "");
  const [libelle, setLibelle] = useState(d.libelle ?? "");
  const [libelleTouche, setLibelleTouche] = useState(Boolean(d.libelle));
  const [note, setNote] = useState(d.note ?? "");
  const [erreur, setErreur] = useState("");

  const membre = state.membres.find((m) => m.id === membreId);
  const manoeuvre = state.manoeuvres.find((w) => w.id === manoeuvreId);
  const appel = state.appels.find((a) => a.id === appelId);
  const avecMembre = type === "cotisation" || type === "appel";

  const libelleAuto = useMemo(() => {
    switch (type) {
      case "cotisation": return membre ? `Cotisation ${membre.nom}` : "Cotisation";
      case "appel": return appel && membre ? `${appel.titre} — ${membre.nom}` : "Appel de fonds";
      case "salaire": return manoeuvre ? `Salaire ${manoeuvre.nom}` : "Salaire";
      case "frais": return "Frais";
      case "entretien": return "Entretien de la plantation";
      default: return "";
    }
  }, [type, membre, manoeuvre, appel]);
  const libelleEffectif = libelleTouche ? libelle : libelleAuto;

  const suggestion =
    type === "cotisation" && membre ? cotisationMensuelle(membre, state.settings)
    : type === "salaire" && manoeuvre ? manoeuvre.salaireMensuel
    : type === "appel" && appel && membre ? partAppel(appel, membre, state.membres)
    : null;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (montant === "" || montant <= 0) return setErreur("Indiquez un montant supérieur à zéro.");
    if (avecMembre && !membre) return setErreur("Choisissez le membre concerné.");
    if (type === "appel" && !appel) return setErreur("Créez d'abord un appel de fonds dans l'onglet « Appels de fonds ».");
    if (type === "salaire" && !manoeuvre) return setErreur("Choisissez le manœuvre concerné.");
    if (!libelleEffectif.trim()) return setErreur("Donnez un libellé à l'opération.");
    onSubmit({
      id: initial?.id ?? nouvelId("v"),
      date, mois, type, montant,
      libelle: libelleEffectif.trim(),
      membreId: avecMembre ? membreId : undefined,
      manoeuvreId: type === "salaire" ? manoeuvreId : undefined,
      appelId: type === "appel" ? appelId : undefined,
      note: note.trim() || undefined,
    });
  }

  return (
    <form onSubmit={submit} className="form-grid">
      <Field label="Type d'opération">
        <select value={type} onChange={(e) => setType(e.target.value as TypeMouvement)}>
          <optgroup label="Entrées">
            {TYPES_ENTREE.map((t) => <option key={t} value={t}>{TYPES[t].label}</option>)}
          </optgroup>
          <optgroup label="Sorties">
            {TYPES_SORTIE.map((t) => <option key={t} value={t}>{TYPES[t].label}</option>)}
          </optgroup>
        </select>
      </Field>
      <Field label="Date de l'opération">
        <input type="date" required value={date}
          onChange={(e) => { setDate(e.target.value); if (!moisTouche && e.target.value) setMois(moisDeDate(e.target.value)); }} />
      </Field>
      {avecMembre && (
        <Field label="Membre">
          <select value={membreId} onChange={(e) => setMembreId(e.target.value)}>
            {state.membres.map((m) => <option key={m.id} value={m.id}>{m.nom}{m.actif ? "" : " (inactif)"}</option>)}
          </select>
        </Field>
      )}
      {type === "appel" && (
        <Field label="Appel de fonds">
          <select value={appelId} onChange={(e) => setAppelId(e.target.value)}>
            {state.appels.map((a) => <option key={a.id} value={a.id}>{a.titre}</option>)}
          </select>
        </Field>
      )}
      {type === "salaire" && (
        <Field label="Manœuvre">
          <select value={manoeuvreId} onChange={(e) => setManoeuvreId(e.target.value)}>
            {state.manoeuvres.map((w) => <option key={w.id} value={w.id}>{w.nom}{w.actif ? "" : " (inactif)"}</option>)}
          </select>
        </Field>
      )}
      <Field label="Mois concerné" help={avecMembre ? "Mois de cotisation que ce paiement couvre." : "Mois auquel l'opération se rapporte."}>
        <MonthField value={mois} onChange={(m) => { setMois(m); setMoisTouche(true); }} />
      </Field>
      <Field label="Montant" help={suggestion != null && suggestion !== montant ? `Attendu : ${fmtFcfa(suggestion)}` : undefined}>
        <div className="btn-row" style={{ flexWrap: "nowrap" }}>
          <div style={{ flex: 1 }}><AmountInput value={montant} onChange={setMontant} required autoFocus={!initial} /></div>
          {suggestion != null && suggestion !== montant && (
            <button type="button" className="btn sm" onClick={() => setMontant(suggestion)}>Attendu</button>
          )}
        </div>
      </Field>
      <Field label="Libellé" span2>
        <input value={libelleEffectif} onChange={(e) => { setLibelle(e.target.value); setLibelleTouche(true); }} />
      </Field>
      <Field label="Note (facultatif)" span2>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. : arriéré, paiement partiel, envoyé par Wave, reçu n°…" />
      </Field>
      {erreur && <p className="error span-2">{erreur}</p>}
      <div className="span-2">
        <FormActions onCancel={onCancel} onDelete={onDelete} submitLabel={initial ? "Enregistrer" : "Ajouter"} busy={enregistrement} />
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- membre

export function MembreForm({ initial, onSubmit, onCancel, onDelete }: FormProps<Membre>) {
  const { state, enregistrement } = useApp();
  const [nom, setNom] = useState(initial?.nom ?? "");
  const [superficie, setSuperficie] = useState<number | "">(initial?.superficie ?? "");
  const [telephone, setTelephone] = useState(initial?.telephone ?? "");
  const [fixe, setFixe] = useState<number | "">(initial?.cotisationFixe ?? "");
  const [debutPerso, setDebutPerso] = useState(Boolean(initial?.debut));
  const [debut, setDebut] = useState(initial?.debut ?? moisCourant());
  const [actif, setActif] = useState(initial?.actif ?? true);
  const [note, setNote] = useState(initial?.note ?? "");
  const [erreur, setErreur] = useState("");

  const apercu = superficie !== "" ? cotisationMensuelle({ ...(initial ?? { id: "", nom, actif }), superficie, cotisationFixe: fixe === "" ? null : fixe }, state.settings) : null;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!nom.trim()) return setErreur("Le nom est obligatoire.");
    if (superficie === "" || superficie <= 0) return setErreur("Indiquez la superficie en hectares.");
    onSubmit({
      id: initial?.id ?? nouvelId("m"),
      nom: nom.trim(), superficie, actif,
      telephone: telephone.trim() || undefined,
      cotisationFixe: fixe === "" ? null : fixe,
      debut: debutPerso ? debut : undefined,
      note: note.trim() || undefined,
    });
  }

  return (
    <form onSubmit={submit} className="form-grid">
      <Field label="Nom" span2><input value={nom} onChange={(e) => setNom(e.target.value)} required autoFocus={!initial} /></Field>
      <Field label="Superficie (hectares)">
        <input type="number" inputMode="decimal" min={0} step={0.01} required value={superficie}
          onChange={(e) => setSuperficie(e.target.value === "" ? "" : Number(e.target.value))} />
      </Field>
      <Field label="Téléphone (facultatif)"><input value={telephone} onChange={(e) => setTelephone(e.target.value)} inputMode="tel" /></Field>
      <Field label="Cotisation fixe (facultatif)" help={`Vide = superficie × ${fmtFcfa(state.settings.tauxHectare)}/ha.`}>
        <AmountInput value={fixe} onChange={setFixe} />
      </Field>
      <Field label="Cotisation mensuelle" help="Calculée automatiquement.">
        <input readOnly className="mono" value={apercu != null ? fmtFcfa(apercu) : "—"} />
      </Field>
      <label className="field inline span-2">
        <input type="checkbox" checked={debutPerso} onChange={(e) => setDebutPerso(e.target.checked)} />
        <span>Ce membre cotise à partir d'un mois différent du début du suivi</span>
      </label>
      {debutPerso && <Field label="Premier mois dû"><MonthField value={debut} onChange={setDebut} /></Field>}
      <label className="field inline span-2">
        <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} />
        <span>Membre actif (compte dans la répartition et les cotisations dues)</span>
      </label>
      <Field label="Note (facultatif)" span2><input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      {erreur && <p className="error span-2">{erreur}</p>}
      <div className="span-2">
        <FormActions onCancel={onCancel} onDelete={onDelete} submitLabel={initial ? "Enregistrer" : "Ajouter"} busy={enregistrement} />
      </div>
    </form>
  );
}

// ------------------------------------------------------------- manœuvre

export function ManoeuvreForm({ initial, onSubmit, onCancel, onDelete }: FormProps<Manoeuvre>) {
  const { enregistrement } = useApp();
  const [nom, setNom] = useState(initial?.nom ?? "");
  const [salaire, setSalaire] = useState<number | "">(initial?.salaireMensuel ?? "");
  const [telephone, setTelephone] = useState(initial?.telephone ?? "");
  const [actif, setActif] = useState(initial?.actif ?? true);
  const [erreur, setErreur] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!nom.trim()) return setErreur("Le nom est obligatoire.");
    if (salaire === "" || salaire < 0) return setErreur("Indiquez le salaire mensuel.");
    onSubmit({ id: initial?.id ?? nouvelId("w"), nom: nom.trim(), salaireMensuel: salaire, telephone: telephone.trim() || undefined, actif });
  }

  return (
    <form onSubmit={submit} className="form-grid">
      <Field label="Nom" span2><input value={nom} onChange={(e) => setNom(e.target.value)} required autoFocus={!initial} /></Field>
      <Field label="Salaire mensuel"><AmountInput value={salaire} onChange={setSalaire} required /></Field>
      <Field label="Téléphone (facultatif)"><input value={telephone} onChange={(e) => setTelephone(e.target.value)} inputMode="tel" /></Field>
      <label className="field inline span-2">
        <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} />
        <span>En poste actuellement</span>
      </label>
      {erreur && <p className="error span-2">{erreur}</p>}
      <div className="span-2">
        <FormActions onCancel={onCancel} onDelete={onDelete} submitLabel={initial ? "Enregistrer" : "Ajouter"} busy={enregistrement} />
      </div>
    </form>
  );
}

// ----------------------------------------------------------------- tâche

const STATUTS: { v: StatutTache; label: string }[] = [
  { v: "prevu", label: "Prévue" },
  { v: "fait", label: "Faite" },
  { v: "non_fait", label: "Non faite" },
];

export function TacheForm({ initial, defaults, onSubmit, onCancel, onDelete }: FormProps<Tache>) {
  const { state, enregistrement } = useApp();
  const d = { ...defaults, ...initial };
  const [titre, setTitre] = useState(d.titre ?? "");
  const [detail, setDetail] = useState(d.detail ?? "");
  const [mois, setMois] = useState(d.mois ?? moisCourant());
  const [semaine, setSemaine] = useState<number | "">(d.semaine ?? "");
  const [statut, setStatut] = useState<StatutTache>(d.statut ?? "prevu");
  const [manoeuvreId, setManoeuvreId] = useState(d.manoeuvreId ?? state.manoeuvres[0]?.id ?? "");
  const [erreur, setErreur] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!titre.trim()) return setErreur("Décrivez la tâche.");
    if (!manoeuvreId) return setErreur("Ajoutez d'abord un manœuvre.");
    onSubmit({
      id: initial?.id ?? nouvelId("t"), manoeuvreId, mois, titre: titre.trim(),
      detail: detail.trim() || undefined, semaine: semaine === "" ? null : semaine, statut,
    });
  }

  return (
    <form onSubmit={submit} className="form-grid">
      <Field label="Tâche" span2><input value={titre} onChange={(e) => setTitre(e.target.value)} required autoFocus={!initial} placeholder="Ex. : Désherbage des interlignes" /></Field>
      <Field label="Mois"><MonthField value={mois} onChange={setMois} /></Field>
      <Field label="Semaine du mois">
        <select value={semaine} onChange={(e) => setSemaine(e.target.value === "" ? "" : Number(e.target.value))}>
          <option value="">Non précisée</option>
          {[1, 2, 3, 4, 5].map((s) => <option key={s} value={s}>Semaine {s}</option>)}
        </select>
      </Field>
      {state.manoeuvres.length > 1 && (
        <Field label="Manœuvre">
          <select value={manoeuvreId} onChange={(e) => setManoeuvreId(e.target.value)}>
            {state.manoeuvres.map((w) => <option key={w.id} value={w.id}>{w.nom}</option>)}
          </select>
        </Field>
      )}
      <Field label="État">
        <select value={statut} onChange={(e) => setStatut(e.target.value as StatutTache)}>
          {STATUTS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
        </select>
      </Field>
      <Field label="Précisions (facultatif)" span2>
        <textarea value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Parcelle, quantités, matériel…" />
      </Field>
      {erreur && <p className="error span-2">{erreur}</p>}
      <div className="span-2">
        <FormActions onCancel={onCancel} onDelete={onDelete} submitLabel={initial ? "Enregistrer" : "Ajouter"} busy={enregistrement} />
      </div>
    </form>
  );
}

// -------------------------------------------------------- appel de fonds

export function AppelForm({ initial, onSubmit, onCancel, onDelete }: FormProps<AppelFonds>) {
  const { state, enregistrement } = useApp();
  const [titre, setTitre] = useState(initial?.titre ?? "");
  const [mois, setMois] = useState(initial?.mois ?? moisCourant());
  const [montant, setMontant] = useState<number | "">(initial?.montantTotal ?? "");
  const [detail, setDetail] = useState(initial?.detail ?? "");
  const [erreur, setErreur] = useState("");

  const actifs = state.membres.filter((m) => m.actif);
  const total = superficieTotale(state.membres);
  const apercu: AppelFonds = { id: "", titre, mois, montantTotal: montant === "" ? 0 : montant };

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!titre.trim()) return setErreur("Donnez un titre à l'appel de fonds.");
    if (montant === "" || montant <= 0) return setErreur("Indiquez le montant total à réunir.");
    if (!actifs.length) return setErreur("Aucun membre actif : ajoutez d'abord des membres.");
    onSubmit({ id: initial?.id ?? nouvelId("a"), titre: titre.trim(), mois, montantTotal: montant, detail: detail.trim() || undefined });
  }

  return (
    <form onSubmit={submit} className="form-grid">
      <Field label="Objet" span2><input value={titre} onChange={(e) => setTitre(e.target.value)} required autoFocus={!initial} placeholder="Ex. : Achat d'engrais NPK" /></Field>
      <Field label="Mois"><MonthField value={mois} onChange={setMois} /></Field>
      <Field label="Montant total à réunir"><AmountInput value={montant} onChange={setMontant} required /></Field>
      <Field label="Précisions (facultatif)" span2><textarea value={detail} onChange={(e) => setDetail(e.target.value)} /></Field>
      {montant !== "" && montant > 0 && actifs.length > 0 && (
        <div className="span-2 card" style={{ background: "var(--surface-2)", borderColor: "transparent" }}>
          <div className="eyebrow">Répartition au prorata des superficies ({fmtHa(total)})</div>
          <div className="list">
            {actifs.map((m) => (
              <div key={m.id} className="list-item" style={{ padding: "5px 0" }}>
                <div className="grow">{m.nom} <span className="muted small">· {fmtHa(m.superficie)}</span></div>
                <span className="amount">{fmtFcfa(partAppel(apercu, m, state.membres))}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {erreur && <p className="error span-2">{erreur}</p>}
      <div className="span-2">
        <FormActions onCancel={onCancel} onDelete={onDelete} submitLabel={initial ? "Enregistrer" : "Créer l'appel"} busy={enregistrement} />
      </div>
    </form>
  );
}
