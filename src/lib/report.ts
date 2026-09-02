import type { AppState, Mois } from "../types";
import { TYPES, resumeMois, situations } from "./calc";
import { fmtMois, fmtNombre } from "./format";

/**
 * Rapport mensuel au format texte, prêt à coller dans WhatsApp
 * (le gras WhatsApp s'écrit *entre astérisques*).
 */
export function rapportMois(state: AppState, mois: Mois): string {
  const r = resumeMois(state, mois);
  const nomMembre = (id?: string) => state.membres.find((m) => m.id === id)?.nom;
  const nomManoeuvre = (id?: string) => state.manoeuvres.find((w) => w.id === id)?.nom;
  const L: string[] = [];

  L.push(`*${state.settings.nom} — ${fmtMois(mois)}*`);
  L.push("");
  L.push("*Entrées :*");
  const entrees = r.mouvements.filter((v) => TYPES[v.type].sens === "entree");
  if (!entrees.length) L.push("- (aucune)");
  for (const v of entrees) {
    const qui = nomMembre(v.membreId);
    const quoi = v.type === "cotisation" ? "cotisation" : v.type === "appel" ? "appel de fonds" : v.libelle;
    L.push(qui ? `- ${qui} : ${fmtNombre(v.montant)} (${quoi})` : `- ${v.libelle} : ${fmtNombre(v.montant)}`);
  }
  L.push(`Total entrées : ${fmtNombre(r.entrees)}`);
  L.push("");
  L.push("*Sorties :*");
  const sorties = r.mouvements.filter((v) => TYPES[v.type].sens === "sortie");
  if (!sorties.length) L.push("- (aucune)");
  for (const v of sorties) {
    const qui = nomManoeuvre(v.manoeuvreId);
    L.push(qui && v.type === "salaire" ? `- Salaire ${qui} : ${fmtNombre(v.montant)}` : `- ${v.libelle} : ${fmtNombre(v.montant)}`);
  }
  L.push(`Total sorties : ${fmtNombre(r.sorties)}`);
  L.push("");
  L.push(`Solde début de mois : ${fmtNombre(r.soldeDebut)}`);
  L.push(`*Solde en caisse : ${fmtNombre(r.soldeFin)} FCFA*`);
  L.push("");
  L.push(`*Situation des membres (fin ${fmtMois(mois).toLowerCase()}) :*`);
  for (const s of situations(state, mois)) {
    if (!s.membre.actif) continue;
    const etat = s.statut === "a_jour" ? "à jour"
      : s.statut === "avance" ? `avance de ${fmtNombre(s.solde)}`
      : `reste à payer ${fmtNombre(-s.solde)}`;
    L.push(`- ${s.membre.nom} : ${etat}`);
  }
  return L.join("\n");
}

/** Export CSV du registre (séparateur « ; », lisible par Excel en français). */
export function csvRegistre(state: AppState): string {
  const nomMembre = (id?: string) => state.membres.find((m) => m.id === id)?.nom ?? "";
  const nomManoeuvre = (id?: string) => state.manoeuvres.find((w) => w.id === id)?.nom ?? "";
  const q = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`;
  const lignes = [["Date", "Mois", "Type", "Libellé", "Membre", "Manœuvre", "Entrée", "Sortie", "Note"].map(q).join(";")];
  const tries = [...state.mouvements].sort((a, b) => a.date.localeCompare(b.date));
  for (const v of tries) {
    const entree = TYPES[v.type].sens === "entree";
    lignes.push([
      v.date, v.mois, TYPES[v.type].label, v.libelle, nomMembre(v.membreId), nomManoeuvre(v.manoeuvreId),
      entree ? v.montant : "", entree ? "" : v.montant, v.note ?? "",
    ].map(q).join(";"));
  }
  return "﻿" + lignes.join("\r\n");
}
