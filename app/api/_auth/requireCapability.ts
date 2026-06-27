import {
  CAPABILITY_REGISTRY,
  type PermissionRole,
} from "@/components/admin/settings/permissions/permissionRegistry";
import { getSupabaseAuthContextFromRequest } from "@/app/api/_auth/supabaseUser";

const VALID_ROLES = new Set<PermissionRole>([
  "owner",
  "admin",
  "developer",
  "operator",
  "beta_tester",
  "power_user",
  "user",
]);

export function normalizePermissionRole(raw: any): PermissionRole {
  const v = String(raw || "").trim();
  return VALID_ROLES.has(v as PermissionRole) ? (v as PermissionRole) : "user";
}

export function capabilityAllowsRole(capabilityKey: string, role: PermissionRole): boolean {
  const cap = CAPABILITY_REGISTRY.find((c) => c.key === capabilityKey);
  if (!cap) return false;
  return cap.defaultRoles.includes(role);
}

export async function requireCapability(req: Request | undefined, capabilityKey: string) {
  if (!req) {
    return { ok: false, status: 401, msg: "missing request" as const };
  }

  const auth = await getSupabaseAuthContextFromRequest(req);
  if (!auth) {
    return { ok: false, status: 401, msg: "missing or invalid auth token" as const };
  }

  const role = normalizePermissionRole(auth.role);
  const allowed = capabilityAllowsRole(capabilityKey, role);

  if (!allowed) {
    return {
      ok: false,
      status: 403,
      msg: "capability required" as const,
      capability: capabilityKey,
      role,
      auth,
    };
  }

  return {
    ok: true,
    status: 200,
    capability: capabilityKey,
    role,
    payload: auth.payload,
    auth,
  };
}
