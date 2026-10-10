/*
 * Ordre d'affichage de la direction (dashboard et comptes rendus) :
 * Principal(e), puis adjoint(e), puis CPE, puis les autres,
 * et par ordre alphabétique à l'intérieur de chaque groupe.
 */

function simplify(value: string | null | undefined) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

export function directionRank(role: string | null | undefined) {
  const r = simplify(role);

  if (!r) return 4;
  if (r.includes('adjoint')) return 1;
  // Avant « principal » : « Conseiller principal d'éducation » = CPE.
  if (/\bcpe\b/.test(r) || r.includes('conseill') || r.includes('vie scolaire')) return 2;
  if (r.includes('principal') || r.includes('chef d')) return 0;

  return 3;
}

export function sortDirection<
  T extends { display_name: string; role?: string | null }
>(members: T[]): T[] {
  return [...members].sort(
    (a, b) =>
      directionRank(a.role) - directionRank(b.role) ||
      simplify(a.display_name).localeCompare(simplify(b.display_name), 'fr')
  );
}
