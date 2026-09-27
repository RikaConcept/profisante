import { useRef, useState, type FormEvent } from "react";
import { useApp } from "../context";
import { attenduMensuel, chargesMensuelles } from "../lib/calc";
import { fmtFcfa } from "../lib/format";
import { effacerLocal, normaliser } from "../storage";
import type { Settings } from "../types";
import { AmountInput, Field, MonthField } from "./ui";

export function Reglages() {
  const { state, commit, lectureSeule, mode, enregistrement, telecharger, notifier } = useApp();
  const s = state.settings;
  const [nom, setNom] = useState(s.nom);
  const [taux, setTaux] = useState<number | "">(s.tauxHectare);
  const [debut, setDebut] = useState(s.debutSuivi);
  const [soldeInitial, setSoldeInitial] = useState<number | "">(s.soldeInitial);
  const [pin, setPin] = useState(s.pinTresorier);
  const [numero, setNumero] = useState(s.paiement.numero);
  const [moyens, setMoyens] = useState(s.paiement.moyens);
  const [whatsapp, setWhatsapp] = useState(s.paiement.whatsapp);
  const [tresorier, setTresorier] = useState(s.paiement.tresorier);
  const [erreur, setErreur] = useState("");
  const fichier = useRef<HTMLInputElement>(null);

  async function enregistrer(e: FormEvent) {
    e.preventDefault();
    if (pin.trim() !== "" && pin.trim().length < 4) return setErreur("Le code trésorier doit compter au moins 4 caractères.");
    if (pin.trim() === "" && mode !== "server") return setErreur("Indiquez un code trésorier.");
    setErreur("");
    const settings: Settings = {
      nom: nom.trim() || s.nom,
      tauxHectare: taux === "" ? 0 : taux,
      debutSuivi: debut,
      soldeInitial: soldeInitial === "" ? 0 : soldeInitial,
      pinTresorier: pin.trim(),
      paiement: {
        numero: numero.trim(),
        moyens: moyens.trim(),
        whatsapp: whatsapp.replace(/\D/g, ""),
        tresorier: tresorier.trim(),
      },
    };
    await commit({ ...state, settings }, "Réglages enregistrés");
  }

  function exporter() {
    const date = new Date().toISOString().slice(0, 10);
    telecharger(`sauvegarde-caisse-${date}.json`, JSON.stringify(state, null, 2), "application/json");
  }

  async function importer(f: File) {
    try {
      const txt = await f.text();
      const etat = normaliser(JSON.parse(txt));
      const n = etat.mouvements.length;
      if (!window.confirm(`Remplacer toutes les données actuelles par ce fichier (${etat.membres.length} membres, ${n} mouvements) ?`)) return;
      await commit(etat, "Données importées");
    } catch {
      notifier("Ce fichier n'est pas une sauvegarde valide.", true);
    }
  }

  return (
    <>
      <div className="section-head">
        <div>
          <h2>Réglages</h2>
          <p className="sub">Règles de calcul des cotisations et sauvegarde des données.</p>
        </div>
      </div>

      <div className="grid-2">
        <form className="card" onSubmit={enregistrer}>
          <h3>Règles de la caisse</h3>
          <Field label="Nom affiché"><input value={nom} onChange={(e) => setNom(e.target.value)} disabled={lectureSeule} /></Field>
          <Field label="Cotisation mensuelle par hectare" help="Chaque membre doit superficie × ce taux, sauf cotisation fixe.">
            <AmountInput value={taux} onChange={setTaux} required />
          </Field>
          <Field label="Premier mois du suivi" help="Les cotisations sont dues à partir de ce mois.">
            <MonthField value={debut} onChange={setDebut} />
          </Field>
          <Field label="Solde de départ de la caisse" help="Argent déjà en caisse avant le premier mouvement enregistré.">
            <AmountInput value={soldeInitial} onChange={setSoldeInitial} />
          </Field>
          <div className="small muted">
            Avec ces règles : {fmtFcfa(attenduMensuel(state))} de cotisations attendues par mois pour {fmtFcfa(chargesMensuelles(state))} de salaires.
          </div>
          <h3 style={{ marginTop: 6 }}>Paiement des membres</h3>
          <Field label="Numéro Mobile Money" help="Affiché dans l'espace « Payer »."><input value={numero} onChange={(e) => setNumero(e.target.value)} inputMode="tel" disabled={lectureSeule} /></Field>
          <Field label="Moyens acceptés"><input value={moyens} onChange={(e) => setMoyens(e.target.value)} placeholder="Orange Money ou Wave" disabled={lectureSeule} /></Field>
          <Field label="WhatsApp du trésorier" help="Format international sans « + », ex. 2250709117568. Sert au bouton « Envoyer sur WhatsApp »."><input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} inputMode="tel" disabled={lectureSeule} /></Field>
          <Field label="Nom du trésorier"><input value={tresorier} onChange={(e) => setTresorier(e.target.value)} disabled={lectureSeule} /></Field>
          <h3 style={{ marginTop: 6 }}>Accès</h3>
          <Field label={mode === "server" ? "Nouveau code trésorier" : "Code trésorier"}
            help={mode === "server" ? "Laissez vide pour conserver le code actuel. Sur le serveur, ce code est la seule protection en écriture : choisissez-le soigneusement." : "Masque les commandes de saisie aux membres. Le vrai droit d'enregistrer reste celui du partage de la page."}>
            <input value={pin} onChange={(e) => setPin(e.target.value)} disabled={lectureSeule} autoComplete="off" />
          </Field>
          {erreur && <p className="error">{erreur}</p>}
          {!lectureSeule && (
            <div className="btn-row end">
              <button type="submit" className="btn primary" disabled={enregistrement}>{enregistrement ? "Enregistrement…" : "Enregistrer"}</button>
            </div>
          )}
        </form>

        <section className="card">
          <h3>Sauvegarde</h3>
          <p className="small muted">
            {mode === "artifact"
              ? "Les données sont enregistrées dans cette page partagée : chaque enregistrement crée une nouvelle version visible par tous les membres."
              : mode === "server"
                ? "Les données sont enregistrées sur le serveur (fichier data/state.json) : tous les membres voient la même caisse, actualisée chaque minute."
                : "Les données sont enregistrées dans ce navigateur uniquement. Exportez régulièrement une sauvegarde."}
          </p>
          <div className="btn-row">
            <button type="button" className="btn" onClick={exporter}>Exporter une sauvegarde (JSON)</button>
            {!lectureSeule && (
              <>
                <button type="button" className="btn" onClick={() => fichier.current?.click()}>Importer une sauvegarde</button>
                <input ref={fichier} type="file" accept="application/json,.json" hidden
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) importer(f); e.target.value = ""; }} />
              </>
            )}
          </div>
          {mode === "local" && (
            <div className="btn-row">
              <button type="button" className="btn danger sm" onClick={() => {
                if (window.confirm("Effacer les données de ce navigateur et revenir aux données de départ ?")) { effacerLocal(); window.location.reload(); }
              }}>Réinitialiser les données locales</button>
            </div>
          )}
        </section>

        <section className="card">
          <h3>Comment sont calculés les chiffres</h3>
          <dl className="kv">
            <dt>Cotisation mensuelle</dt><dd>superficie (ha) × taux par hectare, ou montant fixe du membre</dd>
            <dt>Dû d'un membre</dt><dd>cotisation × nombre de mois depuis le début du suivi (mois en cours inclus) + sa part des appels de fonds</dd>
            <dt>Part d'un appel de fonds</dt><dd>montant total × superficie du membre ÷ superficie totale des membres actifs</dd>
            <dt>Solde d'un membre</dt><dd>total payé − total dû (négatif = reste à payer)</dd>
            <dt>Solde en caisse</dt><dd>solde de départ + entrées − sorties</dd>
            <dt>Déclaration de paiement</dt><dd>annoncée par un membre, elle n'entre en caisse qu'après validation par le trésorier</dd>
            <dt>Rapport mensuel</dt><dd>opérations dont la date tombe dans le mois, quel que soit le mois de cotisation couvert</dd>
          </dl>
        </section>
      </div>
    </>
  );
}
