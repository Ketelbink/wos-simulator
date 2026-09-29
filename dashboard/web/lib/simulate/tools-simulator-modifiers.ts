import type { SideState } from "@/lib/simulate/form-state";

type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : null;

const cityKeys = ["attack","defense","lethality","health","enemy_attack","enemy_defense"] as const;
const petLimits = {
  attack: 10, defense: 10, lethality: 10, health: 10,
  enemy_defense: 10, enemy_lethality: 5, enemy_health: 5,
} as const;

// Shared Tools draft contract for the Bear importer and a later PvP importer.
// Tools stores debuff magnitudes as positive percentages; form-state negates them for the engine.
export function applyToolsSimulatorModifiers(current: SideState, unknownModifiers: unknown): SideState {
  const modifiers = record(unknownModifiers);
  if (!modifiers) return current;
  const city = record(modifiers.city);
  const pets = record(modifiers.pets);
  const state = { ...current };
  if (city) {
    const next = { ...state.statModifiers };
    for (const key of cityKeys) {
      const value = city[key];
      if (value === 0 || value === 10 || value === 20) next[key] = value;
    }
    state.statModifiers = next;
  }
  if (pets) {
    const next = { ...state.petModifiers };
    for (const key of Object.keys(petLimits) as (keyof typeof petLimits)[]) {
      const value = pets[key];
      if (typeof value === "number" && Number.isFinite(value) &&
          value >= 0 && value <= petLimits[key] && Number.isInteger(value * 2)) next[key] = value;
    }
    state.petModifiers = next;
  }
  const gareth = modifiers.gareth;
  if (typeof gareth === "number" && Number.isFinite(gareth) &&
      gareth >= 0 && gareth <= 5 && Number.isInteger(gareth * 4)) state.gareth = gareth;
  return state;
}
