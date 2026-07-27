import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  canApplyForegroundThreadSync,
  decideForegroundThreadSync,
  type ForegroundThreadSyncState,
} from "../lib/foregroundThreadSync.ts";

const idle: ForegroundThreadSyncState = {
  loading: false,
  sending: false,
  hasDraft: false,
  editing: false,
  voiceBusy: false,
  playbackBusy: false,
  privacyDialogOpen: false,
};

test("foreground synchronization switches or refreshes only when idle", () => {
  assert.equal(canApplyForegroundThreadSync(idle), true);
  assert.equal(
    decideForegroundThreadSync("local-thread", "server-thread", idle),
    "switch_now",
  );
  assert.equal(
    decideForegroundThreadSync("same-thread", "same-thread", idle),
    "refresh_current",
  );
  assert.equal(decideForegroundThreadSync(null, null, idle), "none");
});

test("foreground synchronization defers a cross-device switch for every protected state", () => {
  for (const key of Object.keys(idle) as Array<
    keyof ForegroundThreadSyncState
  >) {
    const blocked = { ...idle, [key]: true };
    assert.equal(
      decideForegroundThreadSync("local-thread", "server-thread", blocked),
      "defer",
      `expected ${key} to block an automatic switch`,
    );
  }
});

test("chat pane checks server authority on foreground without polling or cookie authority", () => {
  const source = readFileSync("components/threads/BrainsChatPane.tsx", "utf8");

  assert.match(
    source,
    /authFetchJson<\{ thread_id: string \| null \}>\(\s*"\/api\/threads\/active",\s*\{ cache: "no-store" \}/,
  );
  assert.match(source, /window\.addEventListener\("focus", onForeground\)/);
  assert.match(
    source,
    /document\.addEventListener\("visibilitychange", onVisibilityChange\)/,
  );
  assert.match(source, /window\.addEventListener\("pageshow", onForeground\)/);
  assert.match(source, /Conversation changed on another device\./);
  assert.doesNotMatch(source, /setInterval\([^)]*synchronizeActiveThread/);
  assert.doesNotMatch(source, /vs_tid/);
});
