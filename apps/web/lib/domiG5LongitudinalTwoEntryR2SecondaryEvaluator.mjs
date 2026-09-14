import crypto from "node:crypto";

export const DOMI_G5_FUR2_SECONDARY_EVALUATOR_VERSION = "DOMI_G5_FUR2_SECONDARY_EVALUATOR_V0_1";
const E1 = "G5-E-0001-REAL";
const E2 = "G5-E-0002-REAL";
const F1 = "f123fe84d4059c04249e4fd1bb58a24f60416fbefbda41b17f5046de277213b4";
const F2 = "b4a42f88b79e3fa5ea266e783fe8682b42852d54fa0f379e1683ab42d6141b31";
const ACTIONS = Object.freeze(Array.from({ length: 32 }, (_, i) => `R2_ACTION_${i.toString(16).toUpperCase().padStart(2, "0")}`));
const CLASSES = Object.freeze(["OLDER_ONLY","NEWER_ONLY","ORDERED_PAIR","PROVENANCE_CONTROL","ENUMERATION_ORDER_INVARIANCE"]);
const CONTROLS = Object.freeze(["PRINCIPAL","ABLATE_REQUIRED","ENUM_REVERSED"]);
const S = Object.freeze({ single:"DOMI_G5_FUR2_SINGLE_BASIS_V1", pair:"DOMI_G5_FUR2_ORDERED_PAIR_BASIS_V1", perm:"DOMI_G5_FUR2_PERM_V1", offset:"DOMI_G5_FUR2_OFFSET_V1", bias:"DOMI_G5_FUR2_CLASS_BIAS_V1" });
const FP = Object.freeze({ [E1]:F1, [E2]:F2 });

function h(alg, text) { return crypto.createHash(alg).update(Buffer.from(text,"utf8")).digest("hex"); }
function inspect(c) {
  if (!c || typeof c !== "object" || Array.isArray(c)) throw new Error("G5_FUR2_SECONDARY_CHALLENGE_REQUIRED");
  if (typeof c.challengeId !== "string" || c.challengeId.length !== 34 || !c.challengeId.startsWith("G5-FUR2-C-") || !/^[0-9a-f]{24}$/.test(c.challengeId.slice(10))) throw new Error("G5_FUR2_SECONDARY_CHALLENGE_ID_INVALID");
  if (!CLASSES.includes(c.targetClass)) throw new Error("G5_FUR2_SECONDARY_TARGET_CLASS_INVALID");
  if (!Number.isSafeInteger(c.selector) || c.selector < 0 || c.selector > 31) throw new Error("G5_FUR2_SECONDARY_SELECTOR_INVALID");
  if (typeof c.nonce !== "string" || c.nonce.length !== 40 || !/^[0-9a-f]+$/.test(c.nonce)) throw new Error("G5_FUR2_SECONDARY_NONCE_INVALID");
  const provenanceTarget = c.provenanceTarget ?? null;
  if (c.targetClass === "PROVENANCE_CONTROL") {
    if (!["OLDER","NEWER","PAIR"].includes(provenanceTarget)) throw new Error("G5_FUR2_SECONDARY_PROVENANCE_TARGET_INVALID");
  } else if (provenanceTarget !== null) throw new Error("G5_FUR2_SECONDARY_PROVENANCE_TARGET_UNEXPECTED");
  return Object.freeze({ challengeId:c.challengeId, targetClass:c.targetClass, selector:c.selector, nonce:c.nonce, provenanceTarget });
}
function ids(c) {
  if (c.targetClass === "OLDER_ONLY") return [E1];
  if (c.targetClass === "NEWER_ONLY") return [E2];
  if (c.targetClass === "PROVENANCE_CONTROL") return c.provenanceTarget === "OLDER" ? [E1] : c.provenanceTarget === "NEWER" ? [E2] : [E1,E2];
  return [E1,E2];
}
function action(c) {
  const fingerprints = ids(c).map((id) => FP[id]);
  const basisClass = c.targetClass === "PROVENANCE_CONTROL" ? `PROVENANCE_${c.provenanceTarget}` : c.targetClass;
  const basis = fingerprints.length === 1 ? h("sha512", `${S.single}|${basisClass}|${fingerprints[0]}`) : h("sha512", `${S.pair}|${basisClass}|${fingerprints[0]}|${fingerprints[1]}`);
  const ranks = new Map(ACTIONS.map((a) => [a, h("sha256", `${S.perm}|${basis}|${a}`)]));
  const remaining = [...ACTIONS]; const ordered = [];
  while (remaining.length) {
    let best = 0;
    for (let i=1;i<remaining.length;i+=1) {
      const a=remaining[i], b=remaining[best], ra=ranks.get(a), rb=ranks.get(b);
      if (ra < rb || (ra === rb && a < b)) best=i;
    }
    ordered.push(remaining[best]); remaining.splice(best,1);
  }
  const off = Number(BigInt(`0x${h("sha256", `${S.offset}|${basisClass}|${c.nonce}`).slice(0,8)}`) % 32n);
  const bias = Number(BigInt(`0x${h("sha256", `${S.bias}|${basisClass}`).slice(0,8)}`) % 32n);
  return ordered[((c.selector * 13) + off + bias) & 31];
}
function pack(c, control, disposition, expectedAction, count, ablationTarget=null) {
  return Object.freeze({ evaluator:"SECONDARY", evaluatorVersion:DOMI_G5_FUR2_SECONDARY_EVALUATOR_VERSION, challengeId:c.challengeId, targetClass:c.targetClass, control, ablationTarget, expectedDisposition:disposition, expectedAction, expectedMemoryReadCount:1, expectedMemoryEntryCountSeen:count, expectedContentEchoed:false, scientificRootsMinted:0, production:false });
}
export function deriveG5Fur2SecondaryExpectation({ challenge, control="PRINCIPAL", ablationTarget=null }={}) {
  const c=inspect(challenge);
  if (!CONTROLS.includes(control)) throw new Error("G5_FUR2_SECONDARY_CONTROL_INVALID");
  if (control === "ENUM_REVERSED") {
    if (c.targetClass !== "ENUMERATION_ORDER_INVARIANCE") throw new Error("G5_FUR2_SECONDARY_ENUM_REVERSED_CLASS_INVALID");
    return pack(c,control,"ACTION_SELECTED_ENUMERATION_ORDER_INVARIANCE_R2",action(c),2);
  }
  if (control === "ABLATE_REQUIRED") {
    if (!["OLDER_ONLY","NEWER_ONLY","ORDERED_PAIR"].includes(c.targetClass)) throw new Error("G5_FUR2_SECONDARY_ABLATION_CLASS_INVALID");
    if (c.targetClass === "ORDERED_PAIR") {
      if (!["OLDER","NEWER"].includes(ablationTarget)) throw new Error("G5_FUR2_SECONDARY_PAIR_ABLATION_TARGET_REQUIRED");
      return pack(c,control,"HOLD_MEMORY_INCOMPLETE",null,1,ablationTarget);
    }
    return pack(c,control,"HOLD_MEMORY_UNAVAILABLE",null,0);
  }
  if (c.targetClass === "PROVENANCE_CONTROL") return pack(c,control,"HOLD_UNGOVERNED_MEMORY",null,c.provenanceTarget === "PAIR" ? 2 : 1);
  return pack(c,control,`ACTION_SELECTED_${c.targetClass}_R2`,action(c),["OLDER_ONLY","NEWER_ONLY"].includes(c.targetClass)?1:2);
}
export function describeG5Fur2SecondaryEvaluatorFreeze() {
  return Object.freeze({ version:DOMI_G5_FUR2_SECONDARY_EVALUATOR_VERSION, evaluator:"SECONDARY", implementationStrategy:"ITERATIVE_MIN_SELECTION_PLUS_BIGINT_MOD32", actionCount:32, targetClasses:CLASSES, controls:CONTROLS, primaryEvaluatorImported:false, subjectImported:false, heldoutGeneratorImported:false, governedMemoryReaderImported:false, subjectExecuted:false, heldoutOutcomeInspected:false, scientificRootsMinted:0, production:false });
}
