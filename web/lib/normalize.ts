// Must match the SQL rule in the drinks seed and the entries trigger:
//   lower(regexp_replace(btrim(x), '\s+', ' ', 'g'))
export function normalizeDrinkName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}
