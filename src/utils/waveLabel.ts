/**
 * Formats a RaceResult wave value for display.
 *
 * ✅ RR already ships the wave column with the word "Wave" baked in — every one
 * of 3,954 rows across the 16 cached event feeds reads "Wave 1", "Wave 2" or
 * "Wave 1: Start @ 9h". Putting the translated label in front of that produced
 * "Start Wave Wave 1: Start @ 9h", which said wave twice and overflowed the
 * single-line bib row in the result cards.
 *
 * So RR's own English prefix is stripped and the localised label carries the
 * word instead. That also means nl/fr users get "Startwave 1" / "Vague de
 * départ 1" rather than a bare English value, which the old joined string
 * could never do.
 *
 * A value that does NOT start with "Wave" (an organiser using "A", "Red", "1")
 * is left alone and simply follows the label, exactly as before.
 */
export const formatWave = (label: string, wave?: string | null): string => {
  const raw = (wave ?? '').trim();
  if (!raw) return '';

  // Only RR's own leading "Wave" token goes — never an interior one, so a value
  // like "Wave 2: Wave start" keeps its second word.
  const stripped = raw.replace(/^wave\b[\s:]*/i, '').trim();

  return stripped ? `${label} ${stripped}` : label;
};
