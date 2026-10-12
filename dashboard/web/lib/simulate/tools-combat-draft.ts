type StatRow = Record<string, number>;
type CombatState = { stats: Record<string, StatRow>; petModifiers: Record<string, number> };
const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;

/** Tools exports base stats and separate temporary buffs, never permanent pet totals. */
export function applyToolsCombatDraft<T extends CombatState>(current: T, payload: unknown): T {
  const combat = record(payload);
  if (!combat || typeof combat.petsActive !== 'boolean' || typeof combat.statsIncludePets !== 'boolean') return current;
  const stats = { ...current.stats };
  const input = record(combat.stats);
  for (const category of ['infantry','lancer','marksman']) {
    const row = record(input?.[category]);
    stats[category] = { ...current.stats[category] };
    for (const key of ['attack','defense','lethality','health']) {
      const value = row?.[key];
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 999999.99) stats[category][key] = value;
    }
  }
  const petModifiers = { ...current.petModifiers };
  const modifiers = record(combat.petModifiers);
  for (const key of ['attack','defense','lethality','health','enemy_defense','enemy_lethality','enemy_health']) {
    const value = modifiers?.[key];
    const max = key === 'enemy_lethality' || key === 'enemy_health' ? 5 : 10;
    if (combat.petsActive === false) petModifiers[key] = 0;
    else if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max) petModifiers[key] = value;
  }
  return { ...current, stats, petModifiers };
}
