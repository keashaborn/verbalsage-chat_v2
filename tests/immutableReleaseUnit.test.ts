import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const template = fs.readFileSync(
  path.join(
    process.cwd(),
    "deploy/systemd/verbalsage-v2-immutable-release.conf.in",
  ),
  "utf8",
);

test("frontend release unit is commit-addressed and build-only", () => {
  assert.match(template, /zz-immutable-release\.conf/);
  assert.match(
    template,
    /WorkingDirectory=\/opt\/lifeswitch\/releases\/@COMMIT@/,
  );
  assert.match(
    template,
    /ExecStart=\/usr\/bin\/node \/opt\/lifeswitch\/releases\/@COMMIT@\/server\.js/,
  );
  assert.match(template, /ExecStartPre=\n/);
  assert.match(template, /ExecStart=\n/);
  assert.doesNotMatch(template, /npm (?:run )?build|next build/);
  assert.equal((template.match(/@COMMIT@/g) ?? []).length, 5);
});

test("frontend release unit loads protected live environment files in precedence order", () => {
  const production = template.indexOf(
    "EnvironmentFile=/var/www/verbalsage-chat_v2/.env.production\n",
  );
  const local = template.indexOf(
    "EnvironmentFile=/var/www/verbalsage-chat_v2/.env.local\n",
  );
  const productionLocal = template.indexOf(
    "EnvironmentFile=/var/www/verbalsage-chat_v2/.env.production.local\n",
  );

  assert.ok(production >= 0);
  assert.ok(local > production);
  assert.ok(productionLocal > local);
  assert.doesNotMatch(template, /(?:^|\n)(?:OPENAI_API_KEY|SUPABASE_SECRET_KEY)=/);
});
