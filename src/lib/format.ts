import type { Mois } from "../types";

export const MOIS_NOMS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

/** 148450 → "148.450" (séparateur de milliers « . », comme dans les rapports WhatsApp). */
export function fmtNombre(n: number): string {
  const abs = Math.round(Math.abs(n));
  const s = String(abs).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return n < 0 ? `-${s}` : s;
}

export function fmtFcfa(n: number): string {
  return `${fmtNombre(n)} FCFA`;
}

export function fmtHa(n: number): string {
  return `${String(n).replace(".", ",")} ha`;
}

/** "2026-07" → "Juillet 2026" */
export function fmtMois(m: Mois): string {
  const [a, mm] = m.split("-");
  return `${MOIS_NOMS[Number(mm) - 1] ?? mm} ${a}`;
}

/** "2026-07" → "Juil. 26" */
export function fmtMoisCourt(m: Mois): string {
  const [a, mm] = m.split("-");
  const nom = MOIS_NOMS[Number(mm) - 1] ?? mm;
  return `${nom.slice(0, 4)}${nom.length > 4 ? "." : ""} ${a.slice(2)}`;
}

/** "2026-07-31" → "31/07/2026" */
export function fmtDate(d: string): string {
  const [a, m, j] = d.split("-");
  return `${j}/${m}/${a}`;
}

export function aujourdhui(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function moisCourant(): Mois {
  return aujourdhui().slice(0, 7);
}

export function moisDeDate(date: string): Mois {
  return date.slice(0, 7);
}

export function ajouterMois(m: Mois, n: number): Mois {
  const [a, mm] = m.split("-").map(Number);
  const total = a * 12 + (mm - 1) + n;
  const na = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${na}-${String(nm).padStart(2, "0")}`;
}

/** Liste des mois de `de` à `a` inclus (vide si `a` < `de`). */
export function plageMois(de: Mois, a: Mois): Mois[] {
  const out: Mois[] = [];
  let cur = de;
  while (cur <= a) {
    out.push(cur);
    cur = ajouterMois(cur, 1);
    if (out.length > 600) break;
  }
  return out;
}
