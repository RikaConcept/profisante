import { useEffect, type ReactNode } from "react";
import { useApp } from "../context";
import { MOIS_NOMS, fmtNombre } from "../lib/format";
import type { Mois } from "../types";

// ------------------------------------------------------------------ icônes

const svg = (d: string, size = 16) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
export const IcoCheck = () => svg("M5 12.5l4.5 4.5L19 7");
export const IcoX = () => svg("M6 6l12 12M18 6L6 18");
export const IcoPlus = () => svg("M12 5v14M5 12h14");
export const IcoCopy = () => svg("M9 9h11v11H9zM5 15V4h11");
export const IcoDown = () => svg("M12 4v12m0 0l-5-5m5 5l5-5M4 20h16");
export const IcoBack = () => svg("M15 5l-7 7 7 7");
export const IcoLock = () => svg("M6 11V8a6 6 0 0 1 12 0v3M5 11h14v10H5z");
export const IcoUnlock = () => svg("M6 11V8a6 6 0 0 1 11.5-2.4M5 11h14v10H5z");
export const IcoPalm = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 21V9" />
    <path d="M12 9C9 9 6 7 5 4c3 0 6 1 7 5" />
    <path d="M12 9c3 0 6-2 7-5-3 0-6 1-7 5" />
    <path d="M12 9C10 6 10 4 12 2c2 2 2 4 0 7" />
    <path d="M8 21h8" />
  </svg>
);

// ------------------------------------------------------------- affichage

export function Amount({ n, signed, className }: { n: number; signed?: boolean; className?: string }) {
  const cls = ["amount", n < 0 ? "neg" : "", className ?? ""].join(" ").trim();
  const txt = signed && n > 0 ? `+${fmtNombre(n)}` : fmtNombre(n);
  return <span className={cls}>{txt}</span>;
}

export function Pill({ kind, children, plain }: { kind: "good" | "warn" | "bad" | "neutral"; children: ReactNode; plain?: boolean }) {
  return <span className={`pill ${kind === "neutral" ? "" : kind} ${plain ? "plain" : ""}`}>{children}</span>;
}

export function Stat({ label, value, hint, hero, wide }: { label: string; value: ReactNode; hint?: ReactNode; hero?: boolean; wide?: boolean }) {
  return (
    <div className={`stat ${hero ? "hero" : ""} ${wide ? "wide" : ""}`}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

// ----------------------------------------------------------------- modale

export function Modal({ titre, onClose, children }: { titre: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titre}>
        <div className="modal-head">
          <h3>{titre}</h3>
          <button type="button" className="btn ghost sm" onClick={onClose} aria-label="Fermer"><IcoX /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ------------------------------------------------------------ formulaires

export function Field({ label, help, children, span2 }: { label: string; help?: string; children: ReactNode; span2?: boolean }) {
  return (
    <label className={`field ${span2 ? "span-2" : ""}`}>
      <span>{label}</span>
      {children}
      {help && <small className="help">{help}</small>}
    </label>
  );
}

export function AmountInput({ value, onChange, required, autoFocus }: {
  value: number | ""; onChange: (v: number | "") => void; required?: boolean; autoFocus?: boolean;
}) {
  return (
    <div className="suffix">
      <input type="number" inputMode="numeric" min={0} step={1} required={required} autoFocus={autoFocus}
        value={value} onChange={(e) => onChange(e.target.value === "" ? "" : Math.max(0, Math.round(Number(e.target.value))))} />
    </div>
  );
}

/** Sélecteur mois + année (le type="month" n'est pas pris en charge partout). */
export function MonthField({ value, onChange }: { value: Mois; onChange: (m: Mois) => void }) {
  const [a, m] = value.split("-");
  const anneeCourante = new Date().getFullYear();
  const annees = new Set<number>([Number(a)]);
  for (let y = anneeCourante - 3; y <= anneeCourante + 2; y++) annees.add(y);
  return (
    <div className="month-field">
      <select value={m} onChange={(e) => onChange(`${a}-${e.target.value}`)} aria-label="Mois">
        {MOIS_NOMS.map((nom, i) => (
          <option key={nom} value={String(i + 1).padStart(2, "0")}>{nom}</option>
        ))}
      </select>
      <select value={a} onChange={(e) => onChange(`${e.target.value}-${m}`)} aria-label="Année">
        {[...annees].sort().map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  );
}

export function FormActions({ onCancel, onDelete, submitLabel, busy }: {
  onCancel: () => void; onDelete?: () => void; submitLabel: string; busy?: boolean;
}) {
  return (
    <div className="btn-row" style={{ justifyContent: onDelete ? "space-between" : "flex-end" }}>
      {onDelete && <button type="button" className="btn danger" onClick={onDelete} disabled={busy}>Supprimer</button>}
      <div className="btn-row">
        <button type="button" className="btn" onClick={onCancel} disabled={busy}>Annuler</button>
        <button type="submit" className="btn primary" disabled={busy}>{busy ? "Enregistrement…" : submitLabel}</button>
      </div>
    </div>
  );
}

/** Rappel affiché à la place des commandes de saisie quand le mode trésorier n'est pas actif. */
export function ConsultationHint({ action }: { action: string }) {
  const { tresorier, demanderTresorier } = useApp();
  if (tresorier) return null;
  return (
    <div className="hint-row">
      <span><IcoLock /> {action}</span>
      <button type="button" className="btn sm primary" onClick={demanderTresorier}>Activer la saisie</button>
    </div>
  );
}
