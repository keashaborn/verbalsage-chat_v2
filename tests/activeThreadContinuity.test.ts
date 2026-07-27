import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const activeRouteSource = readFileSync(
  "app/api/threads/active/route.ts",
  "utf8",
);

test("active-thread fallback uses the authenticated Brains service boundary", () => {
  assert.match(
    activeRouteSource,
    /import \{ brainsUpstreamHeaders \} from "@\/app\/api\/_brains\/headers";/,
  );
  assert.match(
    activeRouteSource,
    /headers: brainsUpstreamHeaders\(requestId, user_id, \{\s*Accept: "application\/json",\s*\}\)/,
  );
  assert.doesNotMatch(
    activeRouteSource,
    /headers: \{\s*Accept: "application\/json",\s*\}/,
  );
});

test("active-thread fallback derives ownership before consulting browser state", () => {
  assert.match(activeRouteSource, /const user_id = await getThreadUserId\(req\)/);
  assert.match(activeRouteSource, /if \(!user_id\) return unauthorized\(requestId\)/);
  assert.match(activeRouteSource, /jar\.get\("vs_tid"\)/);
  assert.match(activeRouteSource, /threadBelongsToUser\(tid, user_id, requestId\)/);
});
