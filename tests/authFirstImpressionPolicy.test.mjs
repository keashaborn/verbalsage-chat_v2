import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("public authentication pages share one restrained shell", () => {
  const shell = read("components/auth/PublicAuthShell.tsx");
  const pages = [
    read("app/auth/accept-invite/page.tsx"),
    read("app/auth/confirm-invite/page.tsx"),
  ];

  assert.match(shell, /rounded-xl border bg-background/);
  assert.match(shell, /PUBLIC_AUTH_SECTION_CLASS/);
  assert.match(shell, /PUBLIC_AUTH_PRIMARY_ACTION_CLASS/);
  assert.doesNotMatch(shell, /rounded-2xl/);

  for (const page of pages) {
    assert.match(page, /PublicAuthShell/);
    assert.match(page, /PUBLIC_AUTH_SECTION_CLASS/);
  }
});

test("first-impression forms use visible labels and accessible touch targets", () => {
  const gate = read("components/auth/AuthGate.tsx");

  assert.match(gate, /role="tablist"/);
  assert.match(gate, /aria-selected=\{mode === "login"\}/);
  assert.match(gate, /aria-selected=\{mode === "request"\}/);
  assert.match(gate, /min-h-11/);
  assert.match(gate, /<span>Email<\/span>/);
  assert.match(gate, /<span>Password<\/span>/);
  assert.match(gate, /Sign-in help/);
  assert.match(gate, /Reset saved sign-in session/);
  assert.doesNotMatch(gate, />\s*Clear session\s*</);

});

test("the application viewport permits user zoom", () => {
  const layout = read("app/layout.tsx");

  assert.doesNotMatch(layout, /maximumScale/);
  assert.doesNotMatch(layout, /userScalable/);
  assert.match(layout, /viewportFit: "cover"/);
});

test("Supabase metadata remains the account identity authority", () => {
  const gate = read("components/auth/AuthGate.tsx");

  assert.doesNotMatch(gate, /identity\.sync|syncIdentityBestEffort|\/api\/identity/);
  assert.match(gate, /user_metadata/);
  assert.match(gate, /const showApp = !!session && mfaGate === "clear"/);
});
