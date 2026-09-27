import { createContext, useContext } from "react";
import type { AppState } from "./types";
import type { ModeStockage } from "./storage";

export interface AppCtx {
  state: AppState;
  mode: ModeStockage;
  lectureSeule: boolean;
  /** Le code trésorier a été saisi sur cet appareil. */
  tresorier: boolean;
  /** Ouvre la fenêtre de saisie du code trésorier. */
  demanderTresorier(): void;
  enregistrement: boolean;
  /** Applique un nouvel état et l'enregistre. Résout `true` si l'enregistrement a réussi. */
  commit(next: AppState, message: string): Promise<boolean>;
  /** Propose un fichier au téléchargement (ou copie le contenu si indisponible). */
  telecharger(nomFichier: string, contenu: string, type: string): Promise<void>;
  notifier(message: string, erreur?: boolean): void;
  /** Remplace l'état affiché sans enregistrer (état renvoyé par le serveur). */
  remplacerEtat(next: AppState): void;
}

export const AppContext = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("AppContext manquant");
  return ctx;
}
