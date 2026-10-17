/** Remplace « {n} », « {score} »… dans un texte de l'interface. Utilisable côté serveur et navigateur. */
export const fill = (text: string, values: Record<string, string | number>): string =>
  text.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match))
