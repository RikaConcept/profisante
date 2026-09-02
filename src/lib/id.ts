/** Identifiant court, unique en pratique pour une caisse de quelques centaines de lignes. */
export function nouvelId(prefixe: string): string {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 7);
  return `${prefixe}-${t}${r}`;
}
