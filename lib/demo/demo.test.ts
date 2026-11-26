// Run: npm test   (Node's built-in test runner, no extra packages)
import { test } from "node:test";
import assert from "node:assert/strict";
import { matchUpdate } from "./matching.ts";
import { normalizeClassification, normalizeId } from "./normalize.ts";
import { evaluateBiotinAnswer } from "./biotin.ts";
import { EVIDENCE_UPDATES, GENETIC_REPORT } from "./fixtures.ts";
import { canApprove, initialState, patientMessages, reduce, shareableLangs, type Action } from "./state.ts";
import type { DemoState } from "./types.ts";

let clock = 0;
const run = (s: DemoState, ...actions: Action[]) =>
  actions.reduce((st, a) => reduce(st, a, new Date(Date.UTC(2026, 10, 26, 12, 0, clock++)).toISOString()), s);
const upd = (id: string): Action => ({ type: "processUpdate", updateId: id });
const [A, B, C, D, E] = EVIDENCE_UPDATES.map((u) => u.id);

test("normalisation", () => {
  assert.equal(normalizeId(" syn var 000117 "), "SYN-VAR-000117");
  assert.equal(normalizeId("SYN_VAR_000117"), "SYN-VAR-000117");
  assert.equal(normalizeClassification("VUS"), "vus");
  assert.equal(normalizeClassification("Uncertain significance"), "vus");
  assert.equal(normalizeClassification("likely-benign"), "likely_benign");
  assert.equal(normalizeClassification("weird"), "unknown");
});

test("four update outcomes", () => {
  const r = EVIDENCE_UPDATES.map((u) => matchUpdate(GENETIC_REPORT, u));
  assert.equal(r[0].outcome, "different_variant");
  assert.ok(r[0].geneMatch && r[0].conditionMatch && !r[0].variantMatch);
  assert.equal(r[1].outcome, "different_condition");
  assert.ok(r[1].variantMatch && !r[1].conditionMatch);
  assert.equal(r[2].outcome, "same_interpretation");
  assert.equal(r[3].outcome, "changed_interpretation");
  assert.deepEqual(r.map((x) => x.opensReview), [false, false, false, true, true]);
  assert.equal(r[4].newClassification, "likely_pathogenic");
  assert.deepEqual(r[3].differences, ["classification"]);
});

test("any order: only the genuine match opens one review", () => {
  const s = run(initialState(), upd(D), upd(A), upd(B), upd(C));
  assert.equal(s.reviews.length, 1);
  assert.equal(s.processed.length, 4);
});

test("duplicates before and after approval create nothing new", () => {
  let s = run(initialState(), upd(D), upd(D));
  assert.equal(s.reviews.length, 1);
  assert.equal(s.lastEvent?.kind === "genetic" && s.lastEvent.duplicate, true);
  const id = s.reviews[0].id;
  s = run(s, { type: "setFollowUp", reviewId: id, followUp: "not_needed" }, { type: "approve", reviewId: id });
  assert.equal(s.messages.length, 1);
  s = run(s, upd(D), upd(D), upd(A), upd(A));
  assert.equal(s.reviews.length, 1);
  assert.equal(s.messages.length, 1);
  assert.equal(s.processed.find((p) => p.updateId === D)?.timesReceived, 4);
  // approving twice does nothing
  s = run(s, { type: "approve", reviewId: id });
  assert.equal(s.messages.length, 1);
});

test("pending and dismissed reviews never reach the patient", () => {
  let s = run(initialState(), upd(D));
  assert.equal(patientMessages(s, "pt-nino").length, 0);
  const id = s.reviews[0].id;
  s = run(s, { type: "dismiss", reviewId: id, reason: "  " });
  assert.equal(s.reviews[0].status, "pending", "empty reason is refused");
  s = run(s, { type: "dismiss", reviewId: id, reason: "Discussed in person" });
  assert.equal(s.reviews[0].status, "dismissed");
  assert.equal(patientMessages(s, "pt-nino").length, 0);
  s = run(s, upd(D));
  assert.equal(s.reviews.length, 1, "replay after dismissal does not reopen");
});

test("approved edit is shared exactly; an unchecked translation is withheld", () => {
  let s = run(initialState(), upd(D));
  const id = s.reviews[0].id;
  assert.equal(canApprove(s.reviews[0]).reason, "follow_up");
  const edited = "Edited by Dr. Demo: exact words.";
  s = run(s, { type: "editDraft", reviewId: id, lang: "en", text: edited }, { type: "setFollowUp", reviewId: id, followUp: "recommended" });
  assert.deepEqual(shareableLangs(s.reviews[0]), ["en"], "Georgian is out of date after an English-only edit");
  s = run(s, { type: "approve", reviewId: id });
  assert.deepEqual(s.messages[0].texts, { en: edited });
  assert.equal(s.messages[0].followUp, "recommended");
});

test("catching up the other language makes both shareable", () => {
  let s = run(initialState(), upd(D));
  const id = s.reviews[0].id;
  s = run(s, { type: "editDraft", reviewId: id, lang: "en", text: "EN v2" }, { type: "editDraft", reviewId: id, lang: "ka", text: "KA v2" });
  assert.deepEqual(shareableLangs(s.reviews[0]), ["en", "ka"]);
  s = run(s, { type: "editDraft", reviewId: id, lang: "ka", text: "KA v3" });
  assert.deepEqual(shareableLangs(s.reviews[0]), ["ka"], "a fresh Georgian edit puts English out of date");
  s = run(s, { type: "confirmTranslation", reviewId: id, lang: "en" });
  assert.deepEqual(shareableLangs(s.reviews[0]), ["en", "ka"]);
});

test("biotin rule", () => {
  assert.equal(evaluateBiotinAnswer("yes_before").opensReview, true);
  for (const a of ["started_after", "no", "unsure"] as const) assert.equal(evaluateBiotinAnswer(a).opensReview, false);
  assert.equal(evaluateBiotinAnswer("unsure").flag, "unresolved");
});

test("biotin answers and corrections", () => {
  let s = run(initialState(), { type: "answerBiotin", answer: "yes_before" });
  const pending = () => s.reviews.filter((r) => r.kind === "biotin" && r.status === "pending");
  assert.equal(pending().length, 1);
  s = run(s, { type: "answerBiotin", answer: "yes_before" });
  assert.equal(s.biotinAnswers.length, 1, "same answer twice is not a correction");
  s = run(s, { type: "answerBiotin", answer: "no" });
  assert.equal(pending().length, 0, "stale pending flag is withdrawn");
  assert.equal(s.reviews[0].status, "withdrawn");
  assert.equal(s.biotinAnswers[1].corrects, s.biotinAnswers[0].id);
  s = run(s, { type: "answerBiotin", answer: "unsure" });
  assert.equal(pending().length, 0);
  s = run(s, { type: "answerBiotin", answer: "yes_before" });
  assert.equal(pending().length, 1);
  const id = pending()[0].id;
  s = run(s, { type: "setFollowUp", reviewId: id, followUp: "recommended" }, { type: "approve", reviewId: id });
  assert.equal(patientMessages(s, "pt-davit").length, 1);
  assert.equal(s.messages[0].answerCorrectedAt, undefined);
  s = run(s, { type: "answerBiotin", answer: "started_after" });
  assert.equal(pending().length, 0);
  assert.equal(patientMessages(s, "pt-davit").length, 1, "shared message stays in history");
  assert.ok(s.messages[0].answerCorrectedAt, "and is marked as based on a corrected answer");
});

test("reset restores fixtures but keeps the language", () => {
  let s = run(initialState(), { type: "setLang", lang: "ka" }, upd(D), { type: "answerBiotin", answer: "no" });
  s = run(s, { type: "reset" });
  assert.equal(s.reviews.length + s.messages.length + s.processed.length + s.biotinAnswers.length, 0);
  assert.equal(s.lang, "ka");
});

test("dates are formatted without relying on browser locale data", async () => {
  const { formatDate } = await import("./i18n.ts");
  assert.equal(formatDate("2026-10-21", "ka"), "21 ოქტომბერი, 2026");
  assert.equal(formatDate("2026-03-14", "en"), "14 March 2026");
});

test("standing approval: low-risk change is shared automatically, a serious one never is", () => {
  let s = run(initialState(), { type: "setStanding", patientId: "pt-nino", enabled: true, followUp: "not_needed" });
  s = run(s, upd(D)); // uncertain -> likely benign
  assert.equal(s.reviews[0].status, "approved");
  assert.equal(s.reviews[0].autoShared, true);
  assert.equal(patientMessages(s, "pt-nino").length, 1);
  const m = s.messages[0];
  assert.ok(m.autoShared?.standingSetAt);
  assert.equal(m.followUp, "not_needed");
  assert.ok(m.texts.en && m.texts.ka, "both seeded languages are shared");
  s = run(s, upd(E)); // uncertain -> likely pathogenic
  assert.equal(s.reviews[1].status, "pending", "serious change waits for the doctor");
  assert.equal(patientMessages(s, "pt-nino").length, 1);
  s = run(s, upd(D));
  assert.equal(s.messages.length, 1, "replay still creates nothing");
});

test("standing approval off: everything waits for review", () => {
  let s = run(initialState(), { type: "setStanding", patientId: "pt-nino", enabled: false, followUp: "not_needed" });
  s = run(s, upd(D));
  assert.equal(s.reviews[0].status, "pending");
  assert.equal(s.messages.length, 0);
});

test("low-risk rule", async () => {
  const { isLowRiskChange } = await import("./standing.ts");
  assert.equal(isLowRiskChange("vus", "likely_benign"), true);
  assert.equal(isLowRiskChange("vus", "benign"), true);
  assert.equal(isLowRiskChange("vus", "likely_pathogenic"), false);
  assert.equal(isLowRiskChange("likely_benign", "benign"), false);
  assert.equal(isLowRiskChange("pathogenic", "vus"), false);
});
