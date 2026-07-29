import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

function javascriptFiles(root) {
  const pending = [root];
  const files = [];

  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(entryPath);
      } else if (entry.isFile() && entry.name.endsWith(".js")) {
        files.push(entryPath);
      }
    }
  }

  return files;
}

export function verifyTurnstileArtifact({ artifactDir, siteKey }) {
  const normalizedSiteKey = String(siteKey ?? "").trim();
  if (!normalizedSiteKey) {
    throw new Error(
      "Turnstile artifact verification blocked: site key is missing.",
    );
  }

  const staticDir = path.join(artifactDir, "static");
  if (!existsSync(staticDir) || !statSync(staticDir).isDirectory()) {
    throw new Error(
      "Turnstile artifact verification blocked: .next/static is missing.",
    );
  }

  const files = javascriptFiles(staticDir);
  const embedded = files.some((file) =>
    readFileSync(file, "utf8").includes(normalizedSiteKey),
  );

  if (!embedded) {
    throw new Error(
      "Turnstile artifact verification blocked: the configured site key was not embedded in any browser bundle.",
    );
  }

  return files.length;
}

export function loadAndVerifyTurnstileArtifact(
  projectDir = process.cwd(),
  env = process.env,
) {
  loadEnvConfig(projectDir, false);
  return verifyTurnstileArtifact({
    artifactDir: path.join(projectDir, ".next"),
    siteKey: env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  });
}

function isEntrypoint() {
  return (
    process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
  );
}

if (isEntrypoint()) {
  try {
    const fileCount = loadAndVerifyTurnstileArtifact();
    console.log(
      `Turnstile browser-artifact preflight passed (${fileCount} JavaScript files inspected).`,
    );
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Turnstile artifact invalid.",
    );
    process.exitCode = 1;
  }
}
