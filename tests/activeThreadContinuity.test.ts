import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const activeRouteSource = readFileSync(
  "app/api/threads/active/route.ts",
  "utf8",
);
const selectRouteSource = readFileSync(
  "app/api/threads/select/route.ts",
  "utf8",
);
const clearRouteSource = readFileSync("app/api/threads/clear/route.ts", "utf8");
const createRouteSource = readFileSync("app/api/threads/route.ts", "utf8");
const threadAuthSource = readFileSync("app/api/threads/_threadAuth.ts", "utf8");
const threadViewerSource = readFileSync(
  "components/threads/ThreadViewer.tsx",
  "utf8",
);
const inspectRouteSource = readFileSync(
  "app/api/chat/inspect/route.ts",
  "utf8",
);

test("active-thread fallback uses the authenticated Brains service boundary", () => {
  assert.match(activeRouteSource, /threadUpstreamHeaders,/);
  assert.match(
    activeRouteSource,
    /headers: threadUpstreamHeaders\(req, requestId, user_id, \{\s*Accept: "application\/json",\s*\}\)/,
  );
  assert.doesNotMatch(
    activeRouteSource,
    /headers: \{\s*Accept: "application\/json",\s*\}/,
  );
});

test("active-thread fallback derives ownership before consulting browser state", () => {
  assert.match(
    activeRouteSource,
    /const user_id = await getThreadUserId\(req\)/,
  );
  assert.match(
    activeRouteSource,
    /if \(!user_id\) return unauthorized\(requestId\)/,
  );
  assert.match(
    activeRouteSource,
    /\/threads\/active\/\$\{encodeURIComponent\(user_id\)\}/,
  );
  assert.doesNotMatch(activeRouteSource, /cookies\(\)|threadBelongsToUser/);
});

test("selection, clearing, and creation mutate Brains instead of browser state", () => {
  assert.match(selectRouteSource, /fetch\(`\$\{BRAINS\}\/threads\/active`/);
  assert.match(
    selectRouteSource,
    /JSON\.stringify\(\{ user_id, thread_id \}\)/,
  );
  assert.match(clearRouteSource, /method: "DELETE"/);
  assert.match(
    clearRouteSource,
    /\/threads\/active\/\$\{encodeURIComponent\(user_id\)\}/,
  );
  assert.match(createRouteSource, /fetch\(`\$\{BRAINS\}\/threads\/new`/);
});

test("active-thread behavior no longer reads or writes vs_tid", () => {
  const authoritySources = [
    activeRouteSource,
    selectRouteSource,
    clearRouteSource,
    createRouteSource,
    threadAuthSource,
    threadViewerSource,
    inspectRouteSource,
  ].join("\n");
  assert.doesNotMatch(authoritySources, /vs_tid/);
  assert.match(threadViewerSource, /authFetch\("\/api\/threads\/active"/);
  assert.match(inspectRouteSource, /\/threads\/active\//);
});
