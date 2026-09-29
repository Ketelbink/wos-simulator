import assert from "node:assert/strict";
import test from "node:test";
import { defaultSide, toApiPayload } from "./form-state";
import { applyToolsBeartrapDraft } from "./tools-beartrap-draft";

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

test("Tools City, Pet and Gareth preset reaches Bear form and engine payload", () => {
  const original = defaultSide();
  const result = applyToolsBeartrapDraft(original, {
    version: 1, simulator: "beartrap",
    modifiers: {
      city: { attack: 20, defense: 0, lethality: 10, health: 0, enemy_attack: 10, enemy_defense: 20 },
      pets: { attack: 2.5, defense: 0, lethality: 3.5, health: 0,
        enemy_defense: 7.5, enemy_lethality: 4.5, enemy_health: 2 },
      gareth: 1.25,
    },
  });
  assert.equal(result.statModifiers.attack, 20);
  assert.equal(result.statModifiers.enemy_attack, 10);
  assert.equal(result.petModifiers.enemy_defense, 7.5);
  assert.equal(result.gareth, 1.25);
  assert.equal(original.statModifiers.attack, 0);
  const request = toApiPayload(result, defaultSide(), 1, true);
  assert.equal(request.attacker.stat_modifiers?.enemy_attack, -10);
  assert.equal(request.attacker.pet_modifiers?.enemy_defense, -7.5);
  assert.equal(request.attacker.gareth, 1.25);
});

test("Out-of-range or incorrectly stepped modifiers are ignored", () => {
  const result = applyToolsBeartrapDraft(defaultSide(), {
    version: 1, simulator: "beartrap",
    modifiers: {
      city: { attack: 15, enemy_defense: 20 },
      pets: { attack: 10.5, enemy_health: 2.25, enemy_defense: 8.5 },
      gareth: 5.25,
    },
  });
  assert.equal(result.statModifiers.attack, 0);
  assert.equal(result.statModifiers.enemy_defense, 20);
  assert.equal(result.petModifiers.attack, 0);
  assert.equal(result.petModifiers.enemy_health, 0);
  assert.equal(result.petModifiers.enemy_defense, 8.5);
  assert.equal(result.gareth, 0);
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
  assert.deepEqual(result.heroes.marksman.skills, [4, 0, 0, 0]);
});
