import type {
  AppState, AppelFonds, Membre, Mois, Mouvement, Settings, Tache, TypeMouvement,
} from "../types";
import { moisCourant, moisDeDate, plageMois } from "./format";

export const TYPES: Record<TypeMouvement, { label: string; sens: "entree" | "sortie" }> = {
  cotisation: { label: "Cotisation", sens: "entree" },
  appel: { label: "Appel de fonds", sens: "entree" },
  entree: { label: "Autre entrée", sens: "entree" },
  salaire: { label: "Salaire manœuvre", sens: "sortie" },
  frais: { label: "Frais", sens: "sortie" },
  achat: { label: "Achat / intrant", sens: "sortie" },
  sortie: { label: "Autre sortie", sens: "sortie" },
};

export const TYPES_ENTREE = (Object.keys(TYPES) as TypeMouvement[]).filter((t) => TYPES[t].sens === "entree");
export const TYPES_SORTIE = (Object.keys(TYPES) as TypeMouvement[]).filter((t) => TYPES[t].sens === "sortie");

export function estEntree(t: TypeMouvement): boolean {
  return TYPES[t].sens === "entree";
}

/** Montant signé : positif pour une entrée, négatif pour une sortie. */
export function signe(v: Mouvement): number {
  return estEntree(v.type) ? v.montant : -v.montant;
}

// ---------------------------------------------------------------- membres

export function cotisationMensuelle(m: Membre, s: Settings): number {
  if (m.cotisationFixe != null && m.cotisationFixe > 0) return Math.round(m.cotisationFixe);
  return Math.round(m.superficie * s.tauxHectare);
}

export function superficieTotale(membres: Membre[]): number {
  return membres.filter((m) => m.actif).reduce((s, m) => s + m.superficie, 0);
}

/** Part d'un appel de fonds pour un membre, au prorata de sa superficie. */
export function partAppel(appel: AppelFonds, membre: Membre, membres: Membre[]): number {
  const total = superficieTotale(membres);
  if (!total || !membre.actif) return 0;
  return Math.round((appel.montantTotal * membre.superficie) / total);
}

export function debutMembre(m: Membre, s: Settings): Mois {
  return m.debut && m.debut > s.debutSuivi ? m.debut : s.debutSuivi;
}

export interface LigneMois {
  mois: Mois;
  duCotisation: number;
  duAppels: number;
  paye: number;
}

export interface SituationMembre {
  membre: Membre;
  cotisation: number;
  moisDus: Mois[];
  duCotisations: number;
  duAppels: number;
  du: number;
  payeCotisations: number;
  payeAppels: number;
  paye: number;
  /** payé − dû : négatif = arriéré, positif = avance. */
  solde: number;
  /** Nombre de mensualités entières en retard. */
  moisRetard: number;
  statut: "a_jour" | "retard" | "avance";
  parMois: LigneMois[];
}

export function situationMembre(m: Membre, state: AppState, jusqua: Mois = moisCourant()): SituationMembre {
  const cotisation = cotisationMensuelle(m, state.settings);
  const debut = debutMembre(m, state.settings);
  const moisDus = m.actif ? plageMois(debut, jusqua) : [];
  const appelsDus = state.appels.filter((a) => a.mois >= debut && a.mois <= jusqua);
  const paiements = state.mouvements.filter((v) => v.membreId === m.id);

  const parMois: LigneMois[] = moisDus.map((mois) => ({
    mois,
    duCotisation: cotisation,
    duAppels: appelsDus.filter((a) => a.mois === mois).reduce((s, a) => s + partAppel(a, m, state.membres), 0),
    paye: paiements.filter((v) => v.mois === mois && (v.type === "cotisation" || v.type === "appel"))
      .reduce((s, v) => s + v.montant, 0),
  }));

  const duCotisations = moisDus.length * cotisation;
  const duAppels = appelsDus.reduce((s, a) => s + partAppel(a, m, state.membres), 0);
  const payeCotisations = paiements.filter((v) => v.type === "cotisation").reduce((s, v) => s + v.montant, 0);
  const payeAppels = paiements.filter((v) => v.type === "appel").reduce((s, v) => s + v.montant, 0);
  const du = duCotisations + duAppels;
  const paye = payeCotisations + payeAppels;
  const solde = paye - du;
  const moisRetard = cotisation > 0 && solde < 0 ? Math.floor(-solde / cotisation) : 0;
  const statut = solde < 0 ? "retard" : solde > 0 ? "avance" : "a_jour";

  return {
    membre: m, cotisation, moisDus, duCotisations, duAppels, du,
    payeCotisations, payeAppels, paye, solde, moisRetard, statut, parMois,
  };
}

export function situations(state: AppState, jusqua?: Mois): SituationMembre[] {
  return [...state.membres]
    .sort((a, b) => Number(b.actif) - Number(a.actif) || a.nom.localeCompare(b.nom, "fr"))
    .map((m) => situationMembre(m, state, jusqua));
}

/** Total des cotisations mensuelles attendues (membres actifs). */
export function attenduMensuel(state: AppState): number {
  return state.membres.filter((m) => m.actif).reduce((s, m) => s + cotisationMensuelle(m, state.settings), 0);
}

/** Total des charges mensuelles fixes (salaires des manœuvres actifs). */
export function chargesMensuelles(state: AppState): number {
  return state.manoeuvres.filter((w) => w.actif).reduce((s, w) => s + w.salaireMensuel, 0);
}

// ---------------------------------------------------------------- caisse

export function mouvementsTries(state: AppState): Mouvement[] {
  return [...state.mouvements].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

export function soldeCaisse(state: AppState): number {
  return state.settings.soldeInitial + state.mouvements.reduce((s, v) => s + signe(v), 0);
}

export interface ResumeMois {
  mois: Mois;
  mouvements: Mouvement[];
  entrees: number;
  sorties: number;
  parType: Partial<Record<TypeMouvement, number>>;
  soldeDebut: number;
  soldeFin: number;
}

/** Mouvements de caisse d'un mois calendaire (selon la date de l'opération). */
export function resumeMois(state: AppState, mois: Mois): ResumeMois {
  const tous = mouvementsTries(state);
  const avant = tous.filter((v) => moisDeDate(v.date) < mois);
  const mouvements = tous.filter((v) => moisDeDate(v.date) === mois);
  const soldeDebut = state.settings.soldeInitial + avant.reduce((s, v) => s + signe(v), 0);
  const parType: Partial<Record<TypeMouvement, number>> = {};
  let entrees = 0;
  let sorties = 0;
  for (const v of mouvements) {
    parType[v.type] = (parType[v.type] ?? 0) + v.montant;
    if (estEntree(v.type)) entrees += v.montant;
    else sorties += v.montant;
  }
  return { mois, mouvements, entrees, sorties, parType, soldeDebut, soldeFin: soldeDebut + entrees - sorties };
}

/** Tous les mois entre le début du suivi (ou le premier mouvement) et aujourd'hui (ou le dernier mouvement). */
export function moisDisponibles(state: AppState): Mois[] {
  const dates = state.mouvements.map((v) => moisDeDate(v.date));
  const debut = [state.settings.debutSuivi, ...dates].sort()[0];
  const tries = [moisCourant(), ...dates].sort();
  const fin = tries[tries.length - 1];
  return plageMois(debut, fin).reverse();
}

/** Solde cumulé ligne par ligne, pour le registre. */
export function avecSoldeCourant(state: AppState): { mouvement: Mouvement; solde: number }[] {
  let solde = state.settings.soldeInitial;
  return mouvementsTries(state).map((mouvement) => {
    solde += signe(mouvement);
    return { mouvement, solde };
  });
}

// ---------------------------------------------------------------- manœuvre

export function tachesDuMois(state: AppState, manoeuvreId: string, mois: Mois): Tache[] {
  return state.taches
    .filter((t) => t.manoeuvreId === manoeuvreId && t.mois === mois)
    .sort((a, b) => (a.semaine ?? 9) - (b.semaine ?? 9) || a.titre.localeCompare(b.titre, "fr"));
}

export function salairesVerses(state: AppState, manoeuvreId: string): Mouvement[] {
  return mouvementsTries(state).filter((v) => v.type === "salaire" && v.manoeuvreId === manoeuvreId).reverse();
}

export function salaireDuMoisPaye(state: AppState, manoeuvreId: string, mois: Mois): number {
  return state.mouvements
    .filter((v) => v.type === "salaire" && v.manoeuvreId === manoeuvreId && v.mois === mois)
    .reduce((s, v) => s + v.montant, 0);
}

// ---------------------------------------------------------------- appels de fonds

export interface SituationAppel {
  appel: AppelFonds;
  parts: { membre: Membre; part: number; paye: number }[];
  totalPaye: number;
}

export function situationAppel(appel: AppelFonds, state: AppState): SituationAppel {
  const parts = state.membres
    .filter((m) => m.actif)
    .map((membre) => ({
      membre,
      part: partAppel(appel, membre, state.membres),
      paye: state.mouvements
        .filter((v) => v.type === "appel" && v.appelId === appel.id && v.membreId === membre.id)
        .reduce((s, v) => s + v.montant, 0),
    }));
  return { appel, parts, totalPaye: parts.reduce((s, p) => s + p.paye, 0) };
}
