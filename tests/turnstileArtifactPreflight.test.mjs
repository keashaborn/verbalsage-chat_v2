import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { verifyTurnstileArtifact } from "../scripts/verifyTurnstileArtifact.mjs";

function artifactFixture(t, browserSource) {
  const root = mkdtempSync(path.join(os.tmpdir(), "turnstile-artifact-"));
  const artifactDir = path.join(root, ".next");
  const chunksDir = path.join(artifactDir, "static", "chunks");
  mkdirSync(chunksDir, { recursive: true });
  writeFileSync(path.join(chunksDir, "app.js"), browserSource);
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return artifactDir;
}

test("accepts an artifact containing the configured public site key", (t) => {
  const siteKey = "turnstile-public-test-value";
  const artifactDir = artifactFixture(
    t,
    `window.turnstile.render({sitekey:${JSON.stringify(siteKey)}});`,
  );

  assert.equal(verifyTurnstileArtifact({ artifactDir, siteKey }), 1);
});

test("rejects an artifact that omitted the configured public site key", (t) => {
  const artifactDir = artifactFixture(t, "window.turnstile = undefined;");

  assert.throws(
    () =>
      verifyTurnstileArtifact({
        artifactDir,
        siteKey: "turnstile-public-test-value",
      }),
    /was not embedded/,
  );
});

test("rejects an artifact when the public site key is missing", (t) => {
  const artifactDir = artifactFixture(t, "const ready = true;");
  assert.throws(
    () => verifyTurnstileArtifact({ artifactDir, siteKey: "  " }),
    /site key is missing/,
  );
});
