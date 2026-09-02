import { createContext, useContext } from "react";
import type { AppState } from "./types";
import type { ModeStockage } from "./storage";

export interface AppCtx {
  state: AppState;
  mode: ModeStockage;
  lectureSeule: boolean;
  enregistrement: boolean;
  /** Applique un nouvel état et l'enregistre. Résout `true` si l'enregistrement a réussi. */
  commit(next: AppState, message: string): Promise<boolean>;
  /** Propose un fichier au téléchargement (ou copie le contenu si indisponible). */
  telecharger(nomFichier: string, contenu: string, type: string): Promise<void>;
  notifier(message: string, erreur?: boolean): void;
}

export const AppContext = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("AppContext manquant");
  return ctx;
}
