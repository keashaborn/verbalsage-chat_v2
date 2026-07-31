import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

const { loadEnvConfig } = nextEnv;

const MANIFEST_SCHEMA_VERSION = 1;
const DEFAULT_TIER = "lifeswitch";
const VALID_TIERS = new Set(["verbal_sage", "lifeswitch"]);

function usage() {
  return [
    "Usage:",
    "  node scripts/productTierBackfill.mjs --mode audit",
    "  node scripts/productTierBackfill.mjs --mode apply --expected-count N --manifest /absolute/path.json",
    "  node scripts/productTierBackfill.mjs --mode rollback --manifest /absolute/path.json",
  ].join("\n");
}

function parseArgs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--help") return { help: true };
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${token}`);
    }
    args.set(token.slice(2), value);
    index += 1;
  }

  const mode = args.get("mode");
  if (!new Set(["audit", "apply", "rollback"]).has(mode)) {
    throw new Error("--mode must be audit, apply, or rollback.");
  }

  const expectedRaw = args.get("expected-count");
  const expectedCount = expectedRaw ? Number(expectedRaw) : null;
  if (
    expectedRaw &&
    (!Number.isSafeInteger(expectedCount) || expectedCount < 1)
  ) {
    throw new Error("--expected-count must be a positive integer.");
  }

  const manifestPath = args.get("manifest") || null;
  if ((mode === "apply" || mode === "rollback") && !manifestPath) {
    throw new Error(`--manifest is required for ${mode}.`);
  }
  if (manifestPath && !path.isAbsolute(manifestPath)) {
    throw new Error("--manifest must be an absolute path.");
  }
  if (mode === "apply" && expectedCount === null) {
    throw new Error("--expected-count is required for apply.");
  }

  return { help: false, mode, expectedCount, manifestPath };
}

function plainMetadata(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return structuredClone(value);
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])]),
    );
  }
  return value;
}

function metadataEqual(left, right) {
  return (
    JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right))
  );
}

function tierOf(metadata) {
  const value = metadata?.product_tier;
  return typeof value === "string" && VALID_TIERS.has(value) ? value : null;
}

function makeAdminClient(projectDir) {
  loadEnvConfig(projectDir, false);

  const url = String(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  ).trim();
  const secretKey = String(process.env.SUPABASE_SECRET_KEY || "").trim();
  if (!url || !secretKey.startsWith("sb_secret_")) {
    throw new Error("Supabase administrator environment is not configured.");
  }

  const parsedUrl = new URL(url);
  if (
    parsedUrl.protocol !== "https:" ||
    parsedUrl.username ||
    parsedUrl.password
  ) {
    throw new Error("Supabase administrator URL is invalid.");
  }

  return {
    origin: parsedUrl.origin,
    client: createClient(parsedUrl.toString(), secretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }),
  };
}

async function listAllUsers(client) {
  const users = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw new Error(`Unable to list users: ${error.message}`);
    const batch = data?.users || [];
    users.push(...batch);
    if (batch.length < 1000) break;
  }
  return users;
}

function assertExpectedCount(actual, expected, source) {
  if (actual !== expected) {
    throw new Error(
      `${source} user-count gate failed: expected ${expected}, found ${actual}.`,
    );
  }
}

async function getMetadata(client, userId) {
  const { data, error } = await client.auth.admin.getUserById(userId);
  if (error || !data?.user) {
    throw new Error(
      `Unable to re-read a targeted user: ${error?.message || "missing user"}`,
    );
  }
  return plainMetadata(data.user.app_metadata);
}

async function updateMetadata(client, userId, metadata) {
  const { error } = await client.auth.admin.updateUserById(userId, {
    app_metadata: metadata,
  });
  if (error)
    throw new Error(`Unable to update a targeted user: ${error.message}`);
}

async function writeManifest(manifestPath, manifest) {
  const parent = path.dirname(manifestPath);
  await fs.mkdir(parent, { recursive: true, mode: 0o700 });
  const handle = await fs.open(manifestPath, "wx", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fs.chmod(manifestPath, 0o600);
}

function validateManifest(value) {
  if (
    !value ||
    value.schemaVersion !== MANIFEST_SCHEMA_VERSION ||
    typeof value.projectOrigin !== "string" ||
    !value.projectOrigin.startsWith("https://") ||
    !Number.isSafeInteger(value.expectedUserCount) ||
    value.expectedUserCount < 1 ||
    value.targetTier !== DEFAULT_TIER ||
    !Array.isArray(value.rows)
  ) {
    throw new Error("Rollback manifest is invalid.");
  }

  const ids = new Set();
  for (const row of value.rows) {
    if (
      !row ||
      typeof row.id !== "string" ||
      !row.id ||
      !row.before ||
      typeof row.before !== "object" ||
      Array.isArray(row.before) ||
      !row.after ||
      typeof row.after !== "object" ||
      Array.isArray(row.after) ||
      tierOf(row.after) !== DEFAULT_TIER ||
      ids.has(row.id)
    ) {
      throw new Error("Rollback manifest contains an invalid row.");
    }
    ids.add(row.id);
  }
  return value;
}

async function audit(client) {
  const users = await listAllUsers(client);
  const counts = { lifeswitch: 0, verbal_sage: 0, unassigned_or_invalid: 0 };
  for (const user of users) {
    const tier = tierOf(plainMetadata(user.app_metadata));
    if (tier) counts[tier] += 1;
    else counts.unassigned_or_invalid += 1;
  }
  console.log(`AUDIT total=${users.length} tiers=${JSON.stringify(counts)}`);
}

async function applyBackfill(client, origin, expectedCount, manifestPath) {
  const users = await listAllUsers(client);
  assertExpectedCount(users.length, expectedCount, "Preflight");

  const rows = users
    .map((user) => {
      const before = plainMetadata(user.app_metadata);
      if (tierOf(before)) return null;
      return {
        id: user.id,
        before,
        after: { ...before, product_tier: DEFAULT_TIER },
      };
    })
    .filter(Boolean);

  const manifest = {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    projectOrigin: origin,
    expectedUserCount: expectedCount,
    targetTier: DEFAULT_TIER,
    rows,
  };
  await writeManifest(manifestPath, manifest);

  const changed = [];
  try {
    for (const row of rows) {
      const current = await getMetadata(client, row.id);
      if (!metadataEqual(current, row.before)) {
        throw new Error("Concurrent metadata change detected before backfill.");
      }
      await updateMetadata(client, row.id, row.after);
      const verified = await getMetadata(client, row.id);
      if (!metadataEqual(verified, row.after)) {
        throw new Error("Backfill verification failed for a targeted user.");
      }
      changed.push(row);
    }
  } catch (error) {
    let rollbackFailures = 0;
    for (const row of changed.reverse()) {
      try {
        const current = await getMetadata(client, row.id);
        if (!metadataEqual(current, row.after)) {
          rollbackFailures += 1;
          continue;
        }
        await updateMetadata(client, row.id, row.before);
      } catch {
        rollbackFailures += 1;
      }
    }
    throw new Error(
      `Backfill failed and automatic rollback had ${rollbackFailures} conflict(s): ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }

  const verifiedUsers = await listAllUsers(client);
  assertExpectedCount(verifiedUsers.length, expectedCount, "Postflight");
  const invalid = verifiedUsers.filter(
    (user) => !tierOf(plainMetadata(user.app_metadata)),
  ).length;
  if (invalid !== 0) {
    throw new Error(
      `Postflight tier gate failed: ${invalid} user(s) unassigned.`,
    );
  }

  console.log(
    `APPLIED total=${verifiedUsers.length} changed=${rows.length} preserved=${verifiedUsers.length - rows.length} manifest=${manifestPath}`,
  );
}

async function rollbackBackfill(client, origin, manifestPath) {
  const raw = await fs.readFile(manifestPath, "utf8");
  const manifest = validateManifest(JSON.parse(raw));
  if (manifest.projectOrigin !== origin) {
    throw new Error(
      "Rollback manifest belongs to a different Supabase project.",
    );
  }
  const users = await listAllUsers(client);
  assertExpectedCount(
    users.length,
    manifest.expectedUserCount,
    "Rollback preflight",
  );

  for (const row of manifest.rows) {
    const current = await getMetadata(client, row.id);
    if (!metadataEqual(current, row.after)) {
      throw new Error(
        "Rollback blocked because targeted metadata changed after deployment.",
      );
    }
  }

  const restored = [];
  try {
    for (const row of manifest.rows) {
      await updateMetadata(client, row.id, row.before);
      const verified = await getMetadata(client, row.id);
      if (!metadataEqual(verified, row.before)) {
        throw new Error("Rollback verification failed for a targeted user.");
      }
      restored.push(row);
    }
  } catch (error) {
    let reapplyFailures = 0;
    for (const row of restored.reverse()) {
      try {
        const current = await getMetadata(client, row.id);
        if (!metadataEqual(current, row.before)) {
          reapplyFailures += 1;
          continue;
        }
        await updateMetadata(client, row.id, row.after);
      } catch {
        reapplyFailures += 1;
      }
    }
    throw new Error(
      `Rollback failed and forward restoration had ${reapplyFailures} conflict(s): ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }

  console.log(
    `ROLLED_BACK restored=${manifest.rows.length} manifest=${manifestPath}`,
  );
}

export async function main(
  argv = process.argv.slice(2),
  projectDir = process.cwd(),
) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(usage());
    return;
  }

  const { client, origin } = makeAdminClient(projectDir);
  if (args.mode === "audit") return audit(client);
  if (args.mode === "apply") {
    return applyBackfill(client, origin, args.expectedCount, args.manifestPath);
  }
  return rollbackBackfill(client, origin, args.manifestPath);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Backfill failed.");
    process.exitCode = 1;
  });
}
