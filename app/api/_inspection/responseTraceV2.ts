import { cookies } from "next/headers";

import { requireFreshCapability } from "@/app/api/_auth/requireCapability";
import {
  capabilityAllowsRole,
  normalizePermissionRole,
} from "@/app/api/_auth/requireCapability";
import {
  inspectorSessionCookieName,
  inspectorSessionEnabled,
} from "@/lib/inspectorSession";
import type { ResponseTraceV2 } from "@/lib/responseTraceV2";

const MAX_RESPONSE_TRACE_HEADER_BYTES = 6_000;

async function responseTraceSessionEnabled(): Promise<boolean> {
  const jar = await cookies();
  return inspectorSessionEnabled(jar.get(inspectorSessionCookieName())?.value);
}

export async function responseTraceAccessAllowedV2(
  req: Request,
): Promise<boolean> {
  if (!(await responseTraceSessionEnabled())) return false;
  const capability = await requireFreshCapability(req, "inspector.view");
  return capability.ok;
}

export async function responseTraceAccessAllowedForFreshRoleV2(
  role: string | null | undefined,
): Promise<boolean> {
  if (!(await responseTraceSessionEnabled())) return false;
  return capabilityAllowsRole("inspector.view", normalizePermissionRole(role));
}

export function responseTraceHeadersV2(
  trace: ResponseTraceV2 | null,
): Record<string, string> {
  if (!trace) return {};
  try {
    const encoded = Buffer.from(JSON.stringify(trace), "utf8").toString(
      "base64url",
    );
    if (
      !encoded ||
      Buffer.byteLength(encoded, "ascii") > MAX_RESPONSE_TRACE_HEADER_BYTES
    ) {
      return { "X-VS-Inspection-Status": "unavailable" };
    }
    return {
      "X-VS-Inspection": encoded,
      "X-VS-Inspection-Status": "available",
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      Pragma: "no-cache",
      Vary: "Authorization, Cookie",
    };
  } catch {
    return { "X-VS-Inspection-Status": "unavailable" };
  }
}
