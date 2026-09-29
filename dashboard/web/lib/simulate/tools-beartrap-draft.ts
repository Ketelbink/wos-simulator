import { HEROES, TROOP_TIERS, skillSlotEnabled, type TroopCategory } from "@/lib/heroes-catalogue";
import type { SideState } from "@/lib/simulate/form-state";
import { applyToolsSimulatorModifiers } from "@/lib/simulate/tools-simulator-modifiers";

type RecordValue = Record<string, unknown>;
const categories: TroopCategory[] = ["infantry", "lancer", "marksman"];
const record = (value: unknown): RecordValue | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : null;
const skillLevel = (value: unknown): number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 5 ? value : 0;
const weaponSkillLevel = (value: unknown): number =>
  typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 10
    ? Math.floor(value / 2) : 0;

export function applyToolsBeartrapDraft(current: SideState, unknownDraft: unknown): SideState {
  const draft = record(unknownDraft);
  if (!draft || draft.version !== 1 || draft.simulator !== "beartrap") return current;
  const state: SideState = applyToolsSimulatorModifiers({
    ...current, troops: { ...current.troops }, tiers: { ...current.tiers },
    heroes: {
      infantry: { name: null, skills: [0, 0, 0, 0] },
      lancer: { name: null, skills: [0, 0, 0, 0] },
      marksman: { name: null, skills: [0, 0, 0, 0] },
    },
  }, draft.modifiers);
  const types = record(draft.troops);
  for (const category of categories) {
    const row = record(types?.[category]);
    const tier = row?.tier;
    const fc = row?.fc;
    if ((tier !== 10 && tier !== 11) || (fc !== null && fc !== undefined &&
      (typeof fc !== "number" || !Number.isInteger(fc) || fc < 0 || fc > 10))) continue;
    const choice = `t${tier}${Number(fc) > 0 ? `_fc${fc}` : ""}`;
    if (TROOP_TIERS.includes(choice)) state.tiers[category] = choice;
  }
  state.troops = { infantry: 0, lancer: 0, marksman: 0 };
  const capacity = record(draft.capacities);
  const total = capacity?.solo_bear;
  const plan = record(draft.plan);
  const squads = Array.isArray(plan?.squads) ? plan.squads : [];
  const first = record(squads[0]);
  const ratio = Array.isArray(first?.ratio) ? first.ratio.map(Number) : [];
  if (typeof total === "number" && Number.isSafeInteger(total) && total > 0 &&
      total <= 1000000000 && ratio.length === 3 &&
      ratio.every(value => Number.isFinite(value) && value >= 0 && value <= 100) &&
      ratio.reduce((sum,value) => sum + value, 0) > 0) {
    const sum = ratio.reduce((acc,value) => acc + value, 0);
    state.troops.infantry = Math.floor(total * ratio[0] / sum);
    state.troops.lancer = Math.floor(total * ratio[1] / sum);
    state.troops.marksman = total - state.troops.infantry - state.troops.lancer;
  }
  const heroes = Array.isArray(first?.heroes) ? first.heroes : [];
  const heroDetails = record(draft.heroDetails);
  const slug = (name: string) => name.toLocaleLowerCase("en").replace(/[^a-z0-9]/g, "");
  for (const id of heroes) {
    if (typeof id !== "string" || !id || id === "random-l80") continue;
    const details = record(heroDetails?.[id]);
    const exportedName = details?.name;
    const name = typeof exportedName === "string" ? exportedName : id;
    const hero = HEROES.find(entry => slug(entry.name) === slug(name));
    if (!hero?.troopType) continue;
    const progress = record(details?.progress);
    const expedition = record(record(details?.skillLevels)?.expedition);
    const skills: [number, number, number, number] = [
      skillLevel(progress?.skill),
      skillLevel(expedition?.["2"]),
      skillLevel(expedition?.["3"]),
      skillSlotEnabled(hero, 4, true) ? weaponSkillLevel(progress?.weapon) : 0,
    ];
    for (const slot of [1, 2, 3] as const) {
      if (!skillSlotEnabled(hero, slot, true)) skills[slot - 1] = 0;
    }
    state.heroes[hero.troopType] = { name: hero.name, skills };
  }
  return state;
}
