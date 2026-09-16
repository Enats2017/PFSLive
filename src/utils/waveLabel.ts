/**
 * Formats a RaceResult wave value for display.
 *
 * ✅ RR already ships the wave column with the word "Wave" baked in — every one
 * of 3,954 rows across the 16 cached event feeds reads "Wave 1", "Wave 2" or
 * "Wave 1: Start @ 9h". Putting the translated label in front of that rendered
 * "Start Wave: Wave 1: Start @ 9h", saying wave twice on every row.
 *
 * So RR's own English prefix is stripped and the localised label carries the
 * word instead. That also means nl/fr users get "Startwave 1" / "Vague de
 * départ 1" rather than a line ending in a bare English value, which the old
 * form could never do.
 *
 * A value that does NOT start with "Wave" (an organiser using "A", "Red", "1")
 * is left alone and simply follows the label, exactly as before.
 *
 * Returns '' when there is nothing worth showing, so every caller must render
 * the row only when the result is non-empty — do NOT guard on the raw value.
 */
export const formatWave = (
  label: string,
  wave?: string | null,
  distance?: string | null,
): string => {
  const raw = (wave ?? '').trim();
  if (!raw) return '';

  // ✅ Some organisers use RR's Wave column to carry the DISTANCE for contests
  // that have no real waves. Barrage's participant feed is exactly this: the
  // 21km rows have Wave = '21km', the 48km rows '48km', and only the duo
  // contest carries genuine "Wave 1: Start @ 9h". Echoing that back printed the
  // distance twice on the card — once as the distance, once as a "wave" — so
  // when the value merely repeats the distance there is no wave to show.
  const dist = (distance ?? '').trim();
  if (dist && raw.toLowerCase() === dist.toLowerCase()) return '';

  // Only RR's own leading "Wave" token goes — never an interior one, so a value
  // like "Wave 2: Wave start" keeps its second word.
  const stripped = raw.replace(/^wave\b[\s:]*/i, '').trim();

  return stripped ? `${label} ${stripped}` : label;
};
