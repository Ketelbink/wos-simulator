import assert from "node:assert/strict";
import test from "node:test";
import { defaultSide, toApiPayload, applyStatBonusGroups } from "./form-state";
import { applyToolsBeartrapDraft, applyToolsPvpDraft } from "./tools-beartrap-draft";

test("Beartrap draft maps known tiers and first squad ratio without changing source state", () => {
  const original = defaultSide();
  const draft = {
    version: 1, simulator: "beartrap",
    troops: { infantry: { tier: 10, fc: 7 }, lancer: { tier: 11, fc: 5 } },
    capacities: { solo_bear: 196050 },
    plan: { squads: [{ ratio: ["1", "19", "80"], heroes: ["", "", ""] }] },
  };
  const result = applyToolsBeartrapDraft(original, draft);
  assert.equal(result.tiers.infantry, "t10_fc7");
  assert.equal(result.tiers.lancer, "t11_fc5");
  assert.equal(Object.values(result.troops).reduce((a,b) => a+b, 0), 196050);
  assert.equal(original.troops.infantry, 50000);
});

test("Beartrap import uses solo capacity even when a larger rally capacity exists", () => {
  const result = applyToolsBeartrapDraft(defaultSide(), {
    version: 1, simulator: "beartrap",
    capacities: { solo_bear: 179960, rally_bear: 1331460, rally_standard: 1331460 },
    plan: { squads: [{ ratio: [3, 7, 90] }] },
  });
  assert.deepEqual(result.troops, { infantry: 5398, lancer: 12597, marksman: 161965 });
});

test("Missing Beartrap solo capacity never substitutes a rally capacity", () => {
  const result = applyToolsBeartrapDraft(defaultSide(), {
    version: 1, simulator: "beartrap",
    capacities: { solo_bear: null, rally_bear: 1331460, rally_standard: 1331460 },
    plan: { squads: [{ ratio: [3, 7, 90] }] },
  });
  assert.deepEqual(result.troops, { infantry: 0, lancer: 0, marksman: 0 });
});

test("Missing ratio starts with zero troops instead of misleading simulator counts", () => {
  const result = applyToolsBeartrapDraft(defaultSide(), {
    version: 1, simulator: "beartrap",
    capacities: { solo_bear: 196050 }, plan: null,
  });
  assert.deepEqual(result.troops, { infantry: 0, lancer: 0, marksman: 0 });
});

test("Unknown draft kind cannot alter the form", () => {
  const original = defaultSide();
  assert.equal(applyToolsBeartrapDraft(original, { version: 1, simulator: "other" }), original);
});

test("Beartrap heroes follow their troop type, not the Battle Plan slot order", () => {
  const original = defaultSide();
  original.heroes.infantry = { name: "Jeronimo", skills: [5, 5, 5, 0] };
  const result = applyToolsBeartrapDraft(original, {
    version: 1, simulator: "beartrap",
    heroDetails: {
      "hero-bradley": { name: "Bradley", troopType: "marksman" },
      "hero-hector": { name: "Hector", troopType: "infantry" },
      "hero-mia": { name: "Mia", troopType: "lancer" },
    },
    plan: { squads: [{ heroes: ["hero-bradley", "hero-hector", "hero-mia"], ratio: [3, 7, 90] }] },
  });
  assert.equal(result.heroes.infantry.name, "Hector");
  assert.equal(result.heroes.lancer.name, "Mia");
  assert.equal(result.heroes.marksman.name, "Bradley");
  assert.equal(original.heroes.infantry.name, "Jeronimo");
});

test("Tools Expedition levels and weapon import without treating Exploration as combat skills", () => {
  const result = applyToolsBeartrapDraft(defaultSide(), {
    version: 1, simulator: "beartrap",
    heroDetails: {
      renee: {
        name: "Renee",
        progress: { stars: "4.1", skill: 5, weapon: 6 },
        skillLevels: { exploration: { "1": 5, "2": 4, "3": 3 }, expedition: { "2": 4, "3": 0 } },
      },
    },
    plan: { squads: [{ heroes: ["renee"], ratio: [1, 19, 80] }] },
  });
  assert.deepEqual(result.heroes.lancer.skills, [5, 4, 0, 3]);
});

test("WoS weapon upgrades raise Expedition skill 4 only at even levels", () => {
  const expected = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5];
  for (let weapon = 0; weapon <= 10; weapon++) {
    const result = applyToolsBeartrapDraft(defaultSide(), {
      version: 1, simulator: "beartrap",
      heroDetails: { mia: { name: "Mia", progress: { weapon } } },
      plan: { squads: [{ heroes: ["mia"] }] },
    });
    assert.equal(result.heroes.lancer.skills[3], expected[weapon], `weapon +${weapon}`);
  }
});

test("Imported Hector, Mia and Bradley receive their weapon-derived fourth level", () => {
  const result = applyToolsBeartrapDraft(defaultSide(), {
    version: 1, simulator: "beartrap",
    heroDetails: {
      hector: { name: "Hector", progress: { weapon: 6 } },
      mia: { name: "Mia", progress: { weapon: 10 } },
      bradley: { name: "Bradley", progress: { weapon: 9 } },
    },
    plan: { squads: [{ heroes: ["hector", "mia", "bradley"] }] },
  });
  assert.equal(result.heroes.infantry.skills[3], 3);
  assert.equal(result.heroes.lancer.skills[3], 5);
  assert.equal(result.heroes.marksman.skills[3], 4);
});

test("Missing and invalid Tools levels do not create simulator skills", () => {
  const result = applyToolsBeartrapDraft(defaultSide(), {
    version: 1, simulator: "beartrap",
    heroDetails: {
      jessie: {
        name: "Jessie",
        progress: { skill: 4, weapon: 10 },
        skillLevels: { expedition: { "2": 8, "3": 5 } },
      },
    },
    plan: { squads: [{ heroes: ["jessie"] }] },
  });
  assert.equal(result.heroes.lancer.name, "Jessie");
  assert.deepEqual(result.heroes.lancer.skills, [4, 0, 0, 0]);
  assert.deepEqual(result.heroes.marksman.skills, [0, 0, 0, 0]);
});

test("PvP imports the selected exported squad using standard solo capacity", () => {
  const original = defaultSide();
  const result = applyToolsPvpDraft(original, {
    version: 1, simulator: "pvp", source: "personal",
    capacities: { solo_standard: 165001, solo_bear: 196050, rally_standard: 1000000 },
    heroDetails: { mia: { name: "Mia", progress: { skill: 5, weapon: 10 }, skillLevels: { expedition: { "2": 4, "3": 3 } } } },
    plan: { squads: [{ id: "selected-second", ratio: [45, 5, 50], heroes: ["", "mia", ""] }] },
  });
  assert.deepEqual(result.troops, { infantry: 74250, lancer: 8250, marksman: 82501 });
  assert.deepEqual(result.heroes.lancer, { name: "Mia", skills: [5, 4, 3, 5] });
  assert.deepEqual(result.stats, original.stats);
  assert.deepEqual(result.statModifiers, original.statModifiers);
  assert.deepEqual(result.petModifiers, original.petModifiers);
  assert.notEqual(result, original);
  assert.equal(original.troops.infantry, 50000);
});

test("Beartrap and PvP imports reject each other's drafts", () => {
  const original = defaultSide();
  assert.equal(applyToolsPvpDraft(original, { version: 1, simulator: "beartrap" }), original);
  assert.equal(applyToolsBeartrapDraft(original, { version: 1, simulator: "pvp" }), original);
});

const combat = (included: boolean) => ({
  statsIncludeOwnBuffs: included,
  stats: Object.fromEntries(["infantry", "lancer", "marksman"].map(type => [type, { attack: 1050, defense: null, lethality: 700, health: 600 }])),
  modifiers: {
    statModifiers: { attack: 10, defense: 0, lethality: 0, health: 0, enemy_attack: 10, enemy_defense: 20 },
    petModifiers: { attack: 5, defense: 0, lethality: 0, health: 0, enemy_defense: 10, enemy_lethality: 5, enemy_health: 5 },
    gareth: 2.5,
  },
});

test("Both Tools destinations import saved stats and temporary buffs without adding pet refinement", () => {
  for (const simulator of ["beartrap", "pvp"] as const) {
    const original = defaultSide(), before = structuredClone(original);
    const draft = { version: 1, simulator, battleStats: combat(false), pets: { attack: 999 }, refinement: { health: 999 } };
    const result = simulator === "beartrap" ? applyToolsBeartrapDraft(original, draft) : applyToolsPvpDraft(original, draft);
    assert.equal(result.stats.infantry.attack, 1050);
    assert.equal(result.stats.infantry.health, 600);
    assert.equal(result.stats.infantry.defense, original.stats.infantry.defense, "unknown stats retain the form value");
    assert.equal(result.petModifiers.attack, 5);
    assert.equal(result.gareth, 2.5);
    assert.deepEqual(original, before, "input form is unchanged");
    assert.deepEqual(draft.battleStats, combat(false), "exported snapshot is unchanged");
  }
});

test("Stats already containing City/Pet buffs reproduce the observed stat after a single application", () => {
  const result = applyToolsPvpDraft(defaultSide(), { version: 1, simulator: "pvp", battleStats: combat(true) });
  assert.ok(Math.abs(result.stats.infantry.attack - 900) < 1e-9);
  assert.ok(Math.abs(applyStatBonusGroups(result.stats.infantry.attack, result.statModifiers.attack + result.petModifiers.attack, 0) - 1050) < 1e-9);
  assert.equal(result.stats.infantry.lethality, 700, "enemy debuffs are never removed from own stats");
});

test("Enemy reductions are negated exactly once at the API boundary", () => {
  const result = applyToolsPvpDraft(defaultSide(), { version: 1, simulator: "pvp", battleStats: combat(false) });
  const payload = toApiPayload(result, defaultSide(), 1, true);
  assert.equal(payload.attacker.stat_modifiers?.enemy_attack, -10);
  assert.equal(payload.attacker.stat_modifiers?.enemy_defense, -20);
  assert.equal(payload.attacker.pet_modifiers?.enemy_defense, -10);
  assert.equal(payload.attacker.pet_modifiers?.enemy_lethality, -5);
  assert.equal(payload.attacker.pet_modifiers?.enemy_health, -5);
  assert.equal(payload.attacker.gareth, 2.5);
});

test("Missing, ambiguous and malformed combat blocks cannot silently overwrite the form", () => {
  for (const mutate of [
    (value: ReturnType<typeof combat>) => { delete (value as Partial<typeof value>).statsIncludeOwnBuffs; },
    (value: ReturnType<typeof combat>) => { value.modifiers.petModifiers.attack = 11; },
    (value: ReturnType<typeof combat>) => { value.modifiers.petModifiers.enemy_defense = -10; },
    (value: ReturnType<typeof combat>) => { value.modifiers.gareth = 0.1; },
    (value: ReturnType<typeof combat>) => { value.stats.infantry.attack = NaN; },
  ]) {
    const original = defaultSide(), value = combat(false); mutate(value);
    const result = applyToolsBeartrapDraft(original, { version: 1, simulator: "beartrap", battleStats: value });
    assert.deepEqual(result.stats, original.stats);
    assert.deepEqual(result.petModifiers, original.petModifiers);
  }
});
