import type { SideState } from "./form-state";

type Row = Record<string, unknown>;
const row = (value: unknown): Row | null => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Row : null;
const stats = ["attack", "defense", "lethality", "health"] as const;
const categories = ["infantry", "lancer", "marksman"] as const;
const cityKeys = [...stats, "enemy_attack", "enemy_defense"] as const;
const petKeys = [...stats, "enemy_defense", "enemy_lethality", "enemy_health"] as const;
const percent = (value: unknown, max: number): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max && Math.abs(value * 100 - Math.round(value * 100)) < 0.0001;

/** Permanent pet bonuses/refinement are already part of the saved stat totals. */
export function applyToolsCombatStats(current: SideState, value: unknown): SideState {
  const combat = row(value), values = row(combat?.stats), modifiers = row(combat?.modifiers);
  const city = row(modifiers?.statModifiers), pets = row(modifiers?.petModifiers);
  if (!combat || typeof combat.statsIncludeOwnBuffs !== "boolean" || !values || !modifiers || !city || !pets ||
      !cityKeys.every(key => typeof city[key] === "number" && [0, 10, 20].includes(city[key] as number)) ||
      !petKeys.every(key => percent(pets[key], key === "enemy_lethality" || key === "enemy_health" ? 5 : 10)) ||
      !percent(modifiers?.gareth, 5) || Math.abs((modifiers.gareth as number) * 4 - Math.round((modifiers.gareth as number) * 4)) > 0.0001 ||
      !categories.every(category => { const data = row(values[category]); return data && stats.every(key => data[key] === null || percent(data[key], 999999.99)); })) return current;
  const next = {
    ...current,
    stats: { infantry: { ...current.stats.infantry }, lancer: { ...current.stats.lancer }, marksman: { ...current.stats.marksman } },
    statModifiers: Object.fromEntries(cityKeys.map(key => [key, city[key]])) as SideState["statModifiers"],
    petModifiers: Object.fromEntries(petKeys.map(key => [key, pets[key]])) as SideState["petModifiers"],
    gareth: modifiers.gareth as number,
  };
  for (const category of categories) for (const key of stats) {
    const observed = (values[category] as Row)[key];
    // Unknown readings retain the current form value; never convert null to zero.
    if (observed === null) continue;
    const up = (city[key] as number) + (pets[key] as number);
    next.stats[category][key] = combat.statsIncludeOwnBuffs
      ? (100 + (observed as number)) / (1 + up / 100) - 100
      : observed as number;
  }
  // Positive enemy magnitudes belong to the form. toApiPayload negates them once.
  return next;
}
