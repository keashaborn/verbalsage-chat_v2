import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const chat = fs.readFileSync(
  path.join(root, "app/api/chat/route.ts"),
  "utf8",
);

test("normal chat forwards the verified Supabase bearer to both memory routes", () => {
  assert.match(
    chat,
    /const authorization = auth\s*\?\s*getSupabaseBearerAuthorizationFromRequest\(req\)/,
  );
  const bearerForwardCount = (
    chat.match(/\.\.\.\(authorization \? \{ authorization \} : \{\}\)/g) || []
  ).length;
  assert.equal(bearerForwardCount, 2);
  assert.match(chat, /fetch\(`\$\{brains\}\/log`/);
  assert.match(chat, /fetch\(`\$\{brains\}\/response\/query`/);
});
