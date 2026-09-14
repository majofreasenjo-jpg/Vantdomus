import test from "node:test";
import assert from "node:assert/strict";
import { solveG5FunctionalUseChallenge } from "../lib/domiG5MemoryFunctionalUseSubject.mjs";

const challenge = "G5-FU-C-0123456789abcdef01234567";
const memory = { content: "Debes recordar que todo esfuerzo siempre será bien recompensado" };

test("functional-use subject deterministically binds action to governed memory", () => {
  const a = solveG5FunctionalUseChallenge({ challengeId: challenge, memoryProvider: () => memory });
  const b = solveG5FunctionalUseChallenge({ challengeId: challenge, memoryProvider: () => memory });
  assert.equal(a.disposition, "ACTION_SELECTED_FROM_GOVERNED_MEMORY");
  assert.equal(a.action, b.action);
  assert.match(a.action, /^ACTION_[0-9A-F]$/);
  assert.equal(a.memoryReadCount, 1);
  assert.equal(a.contentEchoed, false);
});

test("memory ablation fails closed instead of guessing", () => {
  const result = solveG5FunctionalUseChallenge({ challengeId: challenge, memoryProvider: () => { throw new Error("ablated"); } });
  assert.equal(result.disposition, "HOLD_MEMORY_UNAVAILABLE");
  assert.equal(result.action, null);
  assert.equal(result.memoryReadCount, 1);
});

test("changed memory changes the keyed functional dependency on at least one frozen challenge panel item", () => {
  const alternate = { content: "Debes recordar que todo esfuerzo no siempre será bien recompensado" };
  const panel = Array.from({ length: 32 }, (_, index) => `G5-FU-C-${index.toString(16).padStart(24, "0")}`);
  const baseActions = panel.map((challengeId) => solveG5FunctionalUseChallenge({ challengeId, memoryProvider: () => memory }).action);
  const alternateActions = panel.map((challengeId) => solveG5FunctionalUseChallenge({ challengeId, memoryProvider: () => alternate }).action);
  assert.ok(baseActions.some((action, index) => action !== alternateActions[index]));
});

test("functional-use subject preserves claim wall", () => {
  const result = solveG5FunctionalUseChallenge({ challengeId: challenge, memoryProvider: () => memory });
  assert.equal(result.scientificRootsMinted, 0);
  assert.equal(result.production, false);
});
