import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";


const source = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");


test("stored chat requires and forwards a stable submission id", () => {
  const route = source("app/api/chat/route.ts");
  assert.match(route, /const rawSubmissionId = body\?\.submission_id/);
  assert.match(route, /if \(!noStore && !submissionId\)/);
  assert.match(route, /submission_id: submissionId/);
});


test("normal text and voice retries reuse a pending submission until success", () => {
  const pane = source("components/threads/BrainsChatPane.tsx");
  const start = pane.indexOf("const responseStartedAt = performance.now()");
  const end = pane.indexOf("if (!reply.trustedWeb)", start);
  assert.ok(start >= 0 && end > start);
  const block = pane.slice(start, end);
  const create = block.indexOf("getOrCreateSubmission(");
  const send = block.indexOf("const reply = await callChat(");
  const clear = block.indexOf("clearPendingSubmission(");
  assert.ok(create >= 0 && send > create && clear > send);
  assert.match(block, /voice_turn_id: options\.voiceTurn\?\.voiceTurnId \|\| null/);
  assert.match(block, /pendingSubmission\.key/);
});


test("regeneration reuses the persisted user message id", () => {
  const pane = source("components/threads/BrainsChatPane.tsx");
  const start = pane.indexOf("async function regenerateLast()");
  const end = pane.indexOf("async function startGovernedListening()", start);
  assert.ok(start >= 0 && end > start);
  const block = pane.slice(start, end);
  assert.match(block, /const lastUserMessageId = String\(lastUserMessage\?\.id/);
  assert.match(block, /lastUserMessageId,\s*\);/);
  assert.doesNotMatch(block, /getOrCreateSubmission/);
});
