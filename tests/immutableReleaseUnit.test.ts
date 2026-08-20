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
  assert.equal((template.match(/@COMMIT@/g) ?? []).length, 8);
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

test("frontend release unit is filesystem and privilege hardened", () => {
  for (const directive of [
    "UMask=0077",
    "NoNewPrivileges=yes",
    "PrivateTmp=yes",
    "PrivateDevices=yes",
    "ProtectSystem=strict",
    "ProtectHome=yes",
    "ProtectKernelTunables=yes",
    "ProtectKernelModules=yes",
    "ProtectKernelLogs=yes",
    "ProtectControlGroups=yes",
    "ProtectClock=yes",
    "ProtectHostname=yes",
    "LockPersonality=yes",
    "RestrictSUIDSGID=yes",
    "RestrictRealtime=yes",
    "RestrictNamespaces=yes",
    "CapabilityBoundingSet=",
    "AmbientCapabilities=",
    "SystemCallArchitectures=native",
    "RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6",
    "CacheDirectoryMode=0700",
  ]) {
    assert.ok(template.includes(`${directive}\n`), directive);
  }

  assert.match(template, /CacheDirectory=lifeswitch-frontend-@COMMIT@/);
  assert.match(
    template,
    /BindPaths=\/var\/cache\/lifeswitch-frontend-@COMMIT@:\/opt\/lifeswitch\/releases\/@COMMIT@\/\.next\/cache/,
  );
  assert.doesNotMatch(template, /ReadWritePaths=\/opt\/lifeswitch\/releases/);
});
