/** Mois au format "AAAA-MM". */
export type Mois = string;

export interface Settings {
  /** Nom affiché dans l'en-tête. */
  nom: string;
  /** Cotisation mensuelle par hectare (FCFA). */
  tauxHectare: number;
  /** Premier mois pris en compte dans le calcul des cotisations dues. */
  debutSuivi: Mois;
  /** Solde de la caisse avant le premier mouvement enregistré. */
  soldeInitial: number;
  /** Code à saisir pour passer en mode trésorier (confort d'affichage ; le droit d'écriture réel est celui du partage de la page). */
  pinTresorier: string;
  /** Coordonnées affichées aux membres pour régler leurs charges. */
  paiement: InfosPaiement;
}

export interface InfosPaiement {
  /** Numéro Mobile Money (Orange Money, Wave…). */
  numero: string;
  /** Libellé des moyens acceptés, ex. « Orange Money ou Wave ». */
  moyens: string;
  /** Numéro WhatsApp du trésorier, format international sans « + » (ex. 2250709117568). */
  whatsapp: string;
  /** Nom du trésorier, affiché aux membres. */
  tresorier: string;
}

export interface Membre {
  id: string;
  nom: string;
  /** Superficie exploitée, en hectares. */
  superficie: number;
  telephone?: string;
  /** Remplace le calcul superficie × taux quand renseigné. */
  cotisationFixe?: number | null;
  /** Premier mois dû pour ce membre (sinon `settings.debutSuivi`). */
  debut?: Mois;
  actif: boolean;
  note?: string;
}

export interface Manoeuvre {
  id: string;
  nom: string;
  salaireMensuel: number;
  telephone?: string;
  actif: boolean;
}

export type StatutTache = "prevu" | "fait" | "non_fait";

export interface Tache {
  id: string;
  manoeuvreId: string;
  mois: Mois;
  /** Semaine du mois (1 à 5), facultatif. */
  semaine?: number | null;
  titre: string;
  detail?: string;
  statut: StatutTache;
}

/** Cotisation exceptionnelle répartie entre les membres au prorata des superficies. */
export interface AppelFonds {
  id: string;
  titre: string;
  mois: Mois;
  montantTotal: number;
  detail?: string;
}

export type TypeMouvement =
  | "cotisation"
  | "appel"
  | "salaire"
  | "frais"
  | "achat"
  | "entree"
  | "sortie";

export interface Mouvement {
  id: string;
  /** Date de l'opération, "AAAA-MM-JJ". */
  date: string;
  /** Mois auquel l'opération se rapporte (cotisation de juillet payée en août, etc.). */
  mois: Mois;
  type: TypeMouvement;
  /** Toujours positif ; le sens est donné par le type. */
  montant: number;
  libelle: string;
  membreId?: string;
  manoeuvreId?: string;
  appelId?: string;
  note?: string;
}

export interface AppState {
  version: 1;
  settings: Settings;
  membres: Membre[];
  manoeuvres: Manoeuvre[];
  taches: Tache[];
  appels: AppelFonds[];
  mouvements: Mouvement[];
}
