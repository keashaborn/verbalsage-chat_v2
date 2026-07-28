import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  hasRequiredPrivilegedAal2,
  PRIVILEGED_MFA_REQUIRED_ERROR,
  PRIVILEGED_MFA_REQUIRED_STATUS,
} from "../app/api/_auth/privilegedMfa.ts";

const root = process.cwd();

function source(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function auth(role: string | null, aal: unknown) {
  return {
    role,
    payload: { aal },
  } as any;
}

test("privileged roles require an exact signed aal2 claim", () => {
  assert.equal(hasRequiredPrivilegedAal2(auth("owner", "aal2")), true);
  assert.equal(hasRequiredPrivilegedAal2(auth("admin", "aal2")), true);
  assert.equal(hasRequiredPrivilegedAal2(auth("owner", "aal1")), false);
  assert.equal(hasRequiredPrivilegedAal2(auth("admin", undefined)), false);
  assert.equal(hasRequiredPrivilegedAal2(auth("owner", "AAL2")), false);
  assert.equal(hasRequiredPrivilegedAal2(auth("user", "aal1")), true);
  assert.equal(hasRequiredPrivilegedAal2(auth(null, undefined)), true);
  assert.equal(PRIVILEGED_MFA_REQUIRED_STATUS, 428);
  assert.equal(PRIVILEGED_MFA_REQUIRED_ERROR, "mfa_verification_required");
});

test("fresh capability authorization enforces privileged MFA", () => {
  const capability = source("app/api/_auth/requireCapability.ts");

  assert.match(capability, /hasRequiredPrivilegedAal2\(auth\)/);
  assert.match(capability, /PRIVILEGED_MFA_REQUIRED_STATUS/);
  assert.match(capability, /PRIVILEGED_MFA_REQUIRED_ERROR/);
});

test("every direct privileged route enforces aal2 after role authorization", () => {
  const routes = [
    "app/api/admin/access/route.ts",
    "app/api/admin/access-requests/route.ts",
    "app/api/admin/access-requests/[requestId]/route.ts",
    "app/api/admin/users/route.ts",
    "app/api/admin/users/[userId]/role/route.ts",
    "app/api/admin/users/[userId]/password-setup/route.ts",
    "app/api/admin/users/[userId]/route.ts",
  ];

  for (const routePath of routes) {
    const route = source(routePath);
    const roleGate = route.search(/auth\.role/);
    const mfaGate = route.search(/hasRequiredPrivilegedAal2\(auth\)/);

    assert.ok(roleGate >= 0, `${routePath}: missing role gate`);
    assert.ok(mfaGate > roleGate, `${routePath}: MFA must follow role gate`);
    assert.match(route, /PRIVILEGED_MFA_REQUIRED_STATUS/, routePath);
    assert.match(route, /PRIVILEGED_MFA_REQUIRED_ERROR/, routePath);
  }
});

function adminRouteFiles(directory = "app/api/admin"): string[] {
  const absolute = path.join(root, directory);
  const routes: string[] = [];

  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      routes.push(...adminRouteFiles(relative));
    } else if (entry.isFile() && entry.name === "route.ts") {
      routes.push(relative.split(path.sep).join("/"));
    }
  }

  return routes.sort();
}

test("all admin routes inherit fresh privileged MFA enforcement", () => {
  const directRoutes = new Set([
    "app/api/admin/access/route.ts",
    "app/api/admin/access-requests/route.ts",
    "app/api/admin/access-requests/[requestId]/route.ts",
    "app/api/admin/users/route.ts",
    "app/api/admin/users/[userId]/role/route.ts",
    "app/api/admin/users/[userId]/password-setup/route.ts",
    "app/api/admin/users/[userId]/route.ts",
  ]);
  const usageRoutes = new Set([
    "app/api/admin/usage/overview/route.ts",
    "app/api/admin/usage/users/route.ts",
    "app/api/admin/usage/users/[userId]/route.ts",
  ]);
  const routes = adminRouteFiles();

  assert.equal(routes.length, 21, "classify every new admin route");
  for (const routePath of routes) {
    const route = source(routePath);
    if (directRoutes.has(routePath)) {
      assert.match(
        route,
        /hasRequiredPrivilegedAal2\(auth\)/,
        `${routePath}: missing direct MFA gate`,
      );
    } else if (usageRoutes.has(routePath)) {
      assert.match(
        route,
        /authorizeUsage\(/,
        `${routePath}: missing usage authorizer`,
      );
    } else {
      assert.match(
        route,
        /requireFreshCapability/,
        `${routePath}: missing fresh capability gate`,
      );
    }
  }

  const usageAuthorizer = source("app/api/admin/usage/_shared.ts");
  assert.match(usageAuthorizer, /requireFreshCapability/);
});
