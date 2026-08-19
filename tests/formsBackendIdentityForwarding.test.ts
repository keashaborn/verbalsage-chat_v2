import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const routeFiles = [
  "app/api/forms/publish/route.ts",
  "app/api/forms/templates/[owner_user_id]/route.ts",
  "app/api/forms/templates/[owner_user_id]/[template_id]/route.ts",
  "app/api/forms/versions/[version_id]/route.ts",
  "app/api/forms/entries/route.ts",
  "app/api/forms/entries/list/route.ts",
];

test("forms BFF derives and forwards fresh Supabase identity", () => {
  for (const relative of routeFiles) {
    const source = fs.readFileSync(path.join(root, relative), "utf8");
    assert.match(source, /getFreshLifeSwitchUpstreamIdentity\(req\)/, relative);
    assert.match(source, /user_id: userId, authorization/, relative);
    assert.match(
      source,
      /brainsUpstreamHeaders\([\s\S]*authorization[\s\S]*\)/,
      relative,
    );
    assert.doesNotMatch(source, /getFreshLifeSwitchUserIdFromRequest/, relative);
  }
});

test("shared helper requires fresh product access and original bearer", () => {
  const source = fs.readFileSync(
    path.join(root, "app/api/_auth/productAccess.ts"),
    "utf8",
  );
  assert.match(
    source,
    /getFreshProductAuthContextFromRequest\(req, "lifeswitch"\)/,
  );
  assert.match(source, /getSupabaseBearerAuthorizationFromRequest\(req\)/);
  assert.match(source, /if \(!auth \|\| !authorization\) return null/);
  assert.match(source, /user_id: auth\.user_id/);
  assert.match(source, /authorization,/);
});
