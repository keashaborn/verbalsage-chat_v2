import { pathToFileURL } from "node:url";

import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

export const REQUIRED_PRODUCTION_AUTH_ENV = Object.freeze([
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  "TURNSTILE_SECRET_KEY",
]);

export function missingRequiredProductionAuthEnv(env) {
  return REQUIRED_PRODUCTION_AUTH_ENV.filter(
    (name) => !String(env[name] ?? "").trim(),
  );
}

export function assertRequiredProductionAuthEnv(env) {
  const missing = missingRequiredProductionAuthEnv(env);
  if (missing.length > 0) {
    throw new Error(
      `Production build blocked: missing required authentication environment variables: ${missing.join(
        ", ",
      )}`,
    );
  }
}

export function loadAndValidateProductionAuthEnv(
  projectDir = process.cwd(),
  env = process.env,
) {
  loadEnvConfig(projectDir, false);
  assertRequiredProductionAuthEnv(env);
  return REQUIRED_PRODUCTION_AUTH_ENV.length;
}

function isEntrypoint() {
  return (
    process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
  );
}

if (isEntrypoint()) {
  try {
    const count = loadAndValidateProductionAuthEnv();
    console.log(
      `Production authentication environment preflight passed (${count} required variables present).`,
    );
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : "Production environment invalid.",
    );
    process.exitCode = 1;
  }
}
