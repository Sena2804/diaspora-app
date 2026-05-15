/**
 * Helpers de calcul d'échéance pour les envois récurrents et les coffres.
 *
 * Convention :
 *   - dayOfPeriod pour 'weekly'  = 1..7 (ISO : 1=lundi, 7=dimanche)
 *   - dayOfPeriod pour 'monthly' = 1..30 (on plafonne à 30 pour éviter
 *     le piège des mois courts ; voir nextMonthlyOccurrence)
 */

export type Frequency = 'weekly' | 'monthly';

export const WEEKDAYS_FR: Record<number, string> = {
  1: 'Lundi',
  2: 'Mardi',
  3: 'Mercredi',
  4: 'Jeudi',
  5: 'Vendredi',
  6: 'Samedi',
  7: 'Dimanche',
};

/** Renvoie le jour ISO 1..7 (1=lundi) pour une Date donnée. */
export function isoDayOfWeek(d: Date): number {
  const js = d.getDay(); // 0=dimanche..6=samedi
  return js === 0 ? 7 : js;
}

/**
 * Prochaine occurrence d'un jour de semaine donné, STRICTEMENT après `from`.
 * Si `from` tombe pile sur le bon jour, on saute à la semaine suivante.
 *
 * NB : on garde l'heure/minute de `from` pour pas faire bouger l'heure
 * d'exécution au fil des occurrences.
 */
export function nextWeeklyOccurrence(from: Date, dayOfWeek: number): Date {
  const current = isoDayOfWeek(from);
  let diff = dayOfWeek - current;
  if (diff <= 0) diff += 7;
  const next = new Date(from);
  next.setDate(next.getDate() + diff);
  return next;
}

/**
 * Prochaine occurrence d'un jour du mois donné (1..30), STRICTEMENT après `from`.
 *
 * Comportement face aux mois courts :
 *   - jour 30 + mois de février → on prend le dernier jour du mois (28 ou 29).
 *   - C'est pour ça qu'on plafonne à 30 (le 31 induirait une asymétrie : il
 *     existerait certains mois et pas d'autres, ce qui rend la com' floue).
 */
export function nextMonthlyOccurrence(from: Date, dayOfMonth: number): Date {
  if (dayOfMonth < 1 || dayOfMonth > 30) {
    throw new Error(`dayOfMonth must be 1..30 (got ${dayOfMonth})`);
  }
  const target = new Date(from);
  // Le jour ciblé dans le mois courant
  target.setDate(1); // bascule au 1er pour éviter les overflows de mois
  target.setMonth(from.getMonth());

  // Si on est déjà passé du jour-cible ce mois-ci, on vise le mois suivant.
  if (from.getDate() >= dayOfMonth) {
    target.setMonth(target.getMonth() + 1);
  }
  // Pose le jour, en clampant au dernier jour du mois si nécessaire.
  const monthBefore = target.getMonth();
  target.setDate(dayOfMonth);
  if (target.getMonth() !== monthBefore) {
    // setDate a fait dépasser → on recule au dernier jour du mois ciblé.
    target.setDate(0);
  }
  // Conserve heure/minute de `from`
  target.setHours(from.getHours(), from.getMinutes(), from.getSeconds(), from.getMilliseconds());
  return target;
}

/**
 * Calcule la prochaine échéance selon la fréquence et le jour ciblé.
 *
 * @param fromIncluding si false (défaut), on cherche STRICTEMENT après `from`.
 *                      si true, on autorise `from` lui-même s'il tombe pile
 *                      sur le bon jour (utile pour le premier calcul à la création).
 */
export function nextOccurrence(
  from: Date,
  frequency: Frequency,
  dayOfPeriod: number,
  fromIncluding = false,
): Date {
  if (fromIncluding) {
    const matches =
      (frequency === 'weekly' && isoDayOfWeek(from) === dayOfPeriod) ||
      (frequency === 'monthly' && from.getDate() === dayOfPeriod);
    if (matches) return new Date(from);
  }
  return frequency === 'weekly'
    ? nextWeeklyOccurrence(from, dayOfPeriod)
    : nextMonthlyOccurrence(from, dayOfPeriod);
}

/** Label humain pour un (frequency, dayOfPeriod). */
export function formatSchedule(frequency: Frequency, dayOfPeriod: number): string {
  if (frequency === 'weekly') {
    return `Chaque ${WEEKDAYS_FR[dayOfPeriod]?.toLowerCase() ?? '?'}`;
  }
  return `Le ${dayOfPeriod} de chaque mois`;
}
