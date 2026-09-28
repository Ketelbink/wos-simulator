import assert from "node:assert/strict";
import test from "node:test";
import { defaultSide } from "./form-state";
import { applyToolsBeartrapDraft } from "./tools-beartrap-draft";

test("Beartrap draft maps known tiers and first squad ratio without changing source state", () => {
  const original = defaultSide();
  const draft = {
    version: 1, simulator: "beartrap",
    troops: { infantry: { tier: 10, fc: 7 }, lancer: { tier: 11, fc: 5 } },
    capacities: { rally_bear: 196050 },
    plan: { squads: [{ ratio: ["1", "19", "80"], heroes: ["", "", ""] }] },
  };
  const result = applyToolsBeartrapDraft(original, draft);
  assert.equal(result.tiers.infantry, "t10_fc7");
  assert.equal(result.tiers.lancer, "t11_fc5");
  assert.equal(Object.values(result.troops).reduce((a,b) => a+b, 0), 196050);
  assert.equal(original.troops.infantry, 50000);
});

test("Missing ratio starts with zero troops instead of misleading simulator counts", () => {
  const result = applyToolsBeartrapDraft(defaultSide(), {
    version: 1, simulator: "beartrap",
    capacities: { rally_bear: 196050 }, plan: null,
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
