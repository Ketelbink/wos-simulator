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
