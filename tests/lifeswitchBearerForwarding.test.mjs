import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const ownerPath = path.join(root, "app/api/lifeswitch/_owner.ts");

function routeFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return routeFiles(target);
    return entry.name === "route.ts" ? [target] : [];
  });
}

test("LifeSwitch upstream headers forward the original bearer and fail closed", () => {
  const source = fs.readFileSync(ownerPath, "utf8");
  assert.match(source, /getSupabaseBearerAuthorizationFromRequest\(req\)/);
  assert.match(source, /if \(actor && !authorization\)/);
  assert.match(source, /missing_lifeswitch_upstream_authorization/);
  assert.match(source, /headers\.authorization = authorization/);
});

test("every LifeSwitch proxy supplies its request to the shared header boundary", () => {
  let calls = 0;
  for (const file of routeFiles(path.join(root, "app/api/lifeswitch"))) {
    const source = fs.readFileSync(file, "utf8");
    const handlers = [
      ...source.matchAll(
        /(?:export\s+)?async\s+function\s+[A-Za-z_$][\w$]*\s*\(\s*([A-Za-z_$][\w$]*)\s*:/g,
      ),
    ];
    for (const match of source.matchAll(
      /lifeSwitchUpstreamHeaders\(\s*([A-Za-z_$][\w$]*)\s*,/g,
    )) {
      const preceding = handlers.filter(
        (handler) => handler.index < match.index,
      );
      assert.ok(preceding.length > 0, `${file}: header call has no handler`);
      assert.equal(
        match[1],
        preceding.at(-1)[1],
        `${file}: wrong request object`,
      );
      calls += 1;
    }
    const rawCalls = [...source.matchAll(/lifeSwitchUpstreamHeaders\(/g)]
      .length;
    const boundCalls = [
      ...source.matchAll(/lifeSwitchUpstreamHeaders\(\s*[A-Za-z_$][\w$]*\s*,/g),
    ].length;
    assert.equal(boundCalls, rawCalls, `${file}: unbound header call`);
  }
  assert.equal(calls, 75);
});
