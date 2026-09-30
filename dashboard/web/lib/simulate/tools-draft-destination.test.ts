import assert from "node:assert/strict";
import test from "node:test";
import { toolsDraftDestination } from "./tools-draft-destination";
const draft = "a".repeat(64);
test("Personal Beartrap and PvP drafts land in their separate simulators", () => {
  assert.equal(toolsDraftDestination(draft, "beartrap")?.href, `https://sim.wos-2277.net/bear?draft=${draft}`);
  assert.equal(toolsDraftDestination(draft, "pvp")?.href, `https://sim.wos-2277.net/simulate?draft=${draft}`);
});
test("Manual entry and older admin draft links preserve their destinations", () => {
  assert.equal(toolsDraftDestination(null, null)?.href, "https://sim.wos-2277.net/simulate");
  assert.equal(toolsDraftDestination(draft, null)?.pathname, "/bear");
});
test("Invalid kinds, URLs and malformed draft tokens cannot choose a redirect", () => {
  assert.equal(toolsDraftDestination(draft, "https://example.com"), null);
  assert.equal(toolsDraftDestination(draft, "labyrinth"), null);
  assert.equal(toolsDraftDestination("a".repeat(63), "pvp"), null);
  assert.equal(toolsDraftDestination(`${draft}&next=evil`, "pvp"), null);
});
