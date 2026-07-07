"use client";

import { authFetch } from "@/lib/authFetch";
import * as React from "react";
import { CardsPanel } from "@/components/admin/settings/CardsPanel";
import { MemoryReviewPanel } from "@/components/admin/settings/MemoryReviewPanel";
import { VANTAGE_CONTROL_REGISTRY } from "@/components/admin/settings/vantage/controlRegistry";
import { CAPABILITY_REGISTRY, PERMISSION_ROLES, type PermissionRole, capabilitiesForRole } from "@/components/admin/settings/permissions/permissionRegistry";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function hasCookie(name: string): boolean {
  const v = readCookie(name);
  return !!(v && v.trim().length > 0);
}

function clearCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
}

function normalizePermissionRoleClient(raw: any): PermissionRole {
  const v = String(raw || "").trim();
  return PERMISSION_ROLES.some((r) => r.key === v) ? (v as PermissionRole) : "user";
}

type EffectiveCapability = {
  key: string;
  label: string;
  category: string;
  scope: string;
  access: string;
  risk: string;
  backendEnforced: boolean;
};

type EffectivePermissionsResponse = {
  ok: boolean;
  authenticated: boolean;
  user_id?: string;
  role: PermissionRole;
  capabilities: EffectiveCapability[];
  capability_count: number;
  critical_count: number;
  backend_enforced_count: number;
  total_capabilities: number;
  error?: string;
};

function capabilityStatusLabel(cap: { backendEnforced: boolean; notes?: string }) {
  if (String(cap.notes || "").includes("Future/hidden module")) return "future/hidden";
  if (String(cap.notes || "").includes("Future module/tier capability")) return "planning";
  return cap.backendEnforced ? "backend enforced" : "frontend only";
}

function capabilityStatusClass(cap: { backendEnforced: boolean; notes?: string }) {
  const label = capabilityStatusLabel(cap);
  if (label === "backend enforced") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (label === "planning") return "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300";
  if (label === "future/hidden") return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  return "border-muted bg-muted/30 text-muted-foreground";
}

function riskClass(risk: string) {
  if (risk === "critical") return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300";
  if (risk === "high") return "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300";
  return "border-muted bg-muted/30 text-muted-foreground";
}


function AdminSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <details className="overflow-hidden rounded-xl border">
      <summary className="cursor-pointer list-none px-3 py-3 hover:bg-muted/40">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold">{title}</div>
            {description ? (
              <div className="mt-0.5 text-xs text-muted-foreground">{description}</div>
            ) : null}
          </div>
          <div className="shrink-0 rounded-lg border px-2 py-0.5 text-xs text-muted-foreground">
            Open
          </div>
        </div>
      </summary>
      <div className="border-t p-3">{children}</div>
    </details>
  );
}

export function AdminConsolePage() {
  const [inspectorEnabled, setInspectorEnabled] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const [currentRole, setCurrentRole] = React.useState<PermissionRole>("user");
  const [effectivePermissions, setEffectivePermissions] = React.useState<EffectivePermissionsResponse | null>(null);

  const stableControls = VANTAGE_CONTROL_REGISTRY.filter((c) => c.status === "stable").length;
  const experimentalControls = VANTAGE_CONTROL_REGISTRY.filter((c) => c.status === "experimental").length;
  const futureControls = VANTAGE_CONTROL_REGISTRY.filter((c) => c.status === "future").length;
  const userVisibleControls = VANTAGE_CONTROL_REGISTRY.filter((c) => c.audience === "user").length;
  const adminControls = VANTAGE_CONTROL_REGISTRY.filter((c) => c.audience === "admin").length;
  const criticalCapabilities = CAPABILITY_REGISTRY.filter((c) => c.risk === "critical").length;
  const backendEnforcedCapabilities = CAPABILITY_REGISTRY.filter((c) => c.backendEnforced).length;
  const planningCapabilities = CAPABILITY_REGISTRY.filter((c) => capabilityStatusLabel(c) === "planning").length;
  const futureHiddenCapabilities = CAPABILITY_REGISTRY.filter((c) => capabilityStatusLabel(c) === "future/hidden").length;
  const capabilityCategories = Array.from(new Set(CAPABILITY_REGISTRY.map((c) => c.category))).length;
  const fallbackEffectiveCapabilities = capabilitiesForRole(currentRole);
  const effectiveCapabilities = effectivePermissions?.capabilities ?? fallbackEffectiveCapabilities;
  const effectiveCapabilityKeys = new Set(effectiveCapabilities.map((c) => c.key));
  const effectiveCriticalCapabilities =
    effectivePermissions?.critical_count ?? fallbackEffectiveCapabilities.filter((c) => c.risk === "critical").length;
  const effectiveBackendCapabilities =
    effectivePermissions?.backend_enforced_count ?? fallbackEffectiveCapabilities.filter((c) => c.backendEnforced).length;
  const effectiveCapabilityCount = effectivePermissions?.capability_count ?? effectiveCapabilities.length;
  const effectiveTotalCapabilities = effectivePermissions?.total_capabilities ?? CAPABILITY_REGISTRY.length;
  const effectiveSource = effectivePermissions?.ok ? "server" : "client fallback";

  React.useEffect(() => {
    setInspectorEnabled(hasCookie("vs_debug_token"));

    let cancelled = false;
    (async () => {
      try {
        const r = await authFetch("/api/auth/capabilities", { method: "GET", cache: "no-store" });
        const j = await r.json().catch(() => null) as EffectivePermissionsResponse | null;
        if (!cancelled && r.ok && j?.ok) {
          setEffectivePermissions(j);
          setCurrentRole(normalizePermissionRoleClient(j.role));
        }
      } catch {
        if (!cancelled) {
          setEffectivePermissions(null);
          setCurrentRole("user");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function enableInspector() {
    setStatus("enabling…");
    try {
      const r = await authFetch("/api/admin/debug_cookie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
      });
      const t = await r.text().catch(() => "");
      if (!r.ok) throw new Error(t || `HTTP ${r.status}`);
      setInspectorEnabled(true);
      setStatus("enabled");
    } catch (e: any) {
      setStatus(`error: ${e?.message || String(e)}`);
    }
  }

  function disableInspector() {
    clearCookie("vs_debug_token");
    setInspectorEnabled(false);
    setStatus("disabled");
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-muted/20 p-3">
        <div className="text-sm font-semibold">Admin Console</div>
        <div className="mt-1 text-xs text-muted-foreground">
          System tools for diagnostics, Vantage registry review, permission preview, and memory/retrieval evaluation.
        </div>
        <div className="mt-2 text-[11px] text-muted-foreground">
          Sections start collapsed to keep this page usable as more administrative tools are added.
        </div>
      </div>

      <AdminSection
        title="Runtime / Diagnostics"
        description="Prompt inspection, model diagnostics, and runtime debugging tools."
      >
        <div className="space-y-3">
          <div className="rounded-xl border p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold">Prompt Inspector</div>
                <div className="text-xs text-muted-foreground">
                  Enables prompt inspection for this browser. Uses cookie <code>vs_debug_token</code>.
                </div>
              </div>

              <input
                type="checkbox"
                checked={inspectorEnabled}
                onChange={(e) => {
                  if (e.target.checked) enableInspector();
                  else disableInspector();
                }}
              />
            </div>

            {status ? <div className="mt-2 text-xs text-muted-foreground">{status}</div> : null}
          </div>

          <div className="rounded-xl border p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold">Model Diagnostics</div>
                <div className="text-xs text-muted-foreground">
                  Run probe suites, store telemetry in seebx, and graph model behavior.
                </div>
              </div>

              <a
                href="/developer/diagnostics"
                className="rounded-lg bg-muted px-3 py-1.5 text-sm font-semibold hover:bg-muted/60"
              >
                Open
              </a>
            </div>
          </div>
        </div>
      </AdminSection>

      <AdminSection
        title="Vantage Registry / Experimental Controls"
        description="Read-only inventory of Vantage levers. Kept admin-only while the system is evaluated."
      >
        <div className="rounded-xl border p-3">
          <div className="text-sm font-semibold">Control Registry</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Read-only inventory of Vantage levers. Later this may be retired, kept internal, or replaced by system-level behavior.
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg border p-2">
              <div className="font-semibold">{VANTAGE_CONTROL_REGISTRY.length}</div>
              <div className="text-muted-foreground">total controls</div>
            </div>
            <div className="rounded-lg border p-2">
              <div className="font-semibold">{userVisibleControls}</div>
              <div className="text-muted-foreground">user-facing planned</div>
            </div>
            <div className="rounded-lg border p-2">
              <div className="font-semibold">{adminControls}</div>
              <div className="text-muted-foreground">admin / system</div>
            </div>
            <div className="rounded-lg border p-2">
              <div className="font-semibold">{stableControls} / {experimentalControls} / {futureControls}</div>
              <div className="text-muted-foreground">stable / experimental / future</div>
            </div>
          </div>

          <div className="mt-3 max-h-52 overflow-auto rounded-lg border">
            <div className="divide-y">
              {VANTAGE_CONTROL_REGISTRY.map((control) => (
                <div key={control.key} className="px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium">{control.label}</div>
                    <div className="shrink-0 text-[11px] uppercase tracking-wide text-muted-foreground">
                      {control.audience} · {control.status} · {control.risk}
                    </div>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{control.description}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </AdminSection>

      <AdminSection
        title="Permissions / Identity Preview"
        description="Current role, effective capabilities, and the capability registry."
      >
        <div className="space-y-3">
          <div className="rounded-xl border p-3">
            <div className="text-sm font-semibold">Permissions</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Read-only capability registry for roles, admin tools, Assistant Profile levers, memory tools, diagnostics, account data, and LifeSwitch module planning.
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border p-2">
                <div className="font-semibold">{PERMISSION_ROLES.length}</div>
                <div className="text-muted-foreground">roles</div>
              </div>
              <div className="rounded-lg border p-2">
                <div className="font-semibold">{CAPABILITY_REGISTRY.length}</div>
                <div className="text-muted-foreground">capabilities</div>
              </div>
              <div className="rounded-lg border p-2">
                <div className="font-semibold">{criticalCapabilities}</div>
                <div className="text-muted-foreground">critical</div>
              </div>
              <div className="rounded-lg border p-2">
                <div className="font-semibold">{backendEnforcedCapabilities}</div>
                <div className="text-muted-foreground">backend enforced</div>
              </div>
              <div className="rounded-lg border p-2">
                <div className="font-semibold">{planningCapabilities}</div>
                <div className="text-muted-foreground">planning</div>
              </div>
              <div className="rounded-lg border p-2">
                <div className="font-semibold">{futureHiddenCapabilities}</div>
                <div className="text-muted-foreground">future / hidden</div>
              </div>
            </div>

            <div className="mt-2 text-xs text-muted-foreground">
              Categories: {capabilityCategories}. Future rule: frontend visibility is convenience; backend enforcement is the security boundary.
            </div>
          </div>

          <div className="rounded-xl border p-3">
            <div className="text-sm font-semibold">Effective Permissions Preview</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Current role: <span className="font-semibold uppercase text-foreground">{currentRole}</span>
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Source: {effectiveSource}
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-lg border p-2">
                <div className="font-semibold">{effectiveCapabilityCount} / {effectiveTotalCapabilities}</div>
                <div className="text-muted-foreground">allowed</div>
              </div>
              <div className="rounded-lg border p-2">
                <div className="font-semibold">{effectiveCriticalCapabilities}</div>
                <div className="text-muted-foreground">critical</div>
              </div>
              <div className="rounded-lg border p-2">
                <div className="font-semibold">{effectiveBackendCapabilities}</div>
                <div className="text-muted-foreground">backend</div>
              </div>
            </div>

            <div className="mt-3 max-h-40 overflow-auto rounded-lg border">
              <div className="divide-y">
                {CAPABILITY_REGISTRY.map((cap) => {
                  const allowed = effectiveCapabilityKeys.has(cap.key);
                  return (
                    <div key={cap.key} className="flex items-center justify-between gap-3 px-3 py-2">
                      <div className="min-w-0">
                        <div className="text-xs font-medium">{cap.key}</div>
                        <div className="text-[11px] text-muted-foreground">{cap.category} · {cap.risk}</div>
                      </div>
                      <div className={allowed ? "text-xs font-semibold" : "text-xs text-muted-foreground"}>
                        {allowed ? "allowed" : "blocked"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="max-h-52 overflow-auto rounded-lg border">
            <div className="divide-y">
              {CAPABILITY_REGISTRY.map((cap) => (
                <div key={cap.key} className="px-3 py-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{cap.label}</div>
                      <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">{cap.key}</div>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1 text-[10px] uppercase tracking-wide">
                      <span className={`rounded-full border px-2 py-0.5 ${capabilityStatusClass(cap)}`}>
                        {capabilityStatusLabel(cap)}
                      </span>
                      <span className={`rounded-full border px-2 py-0.5 ${riskClass(cap.risk)}`}>
                        {cap.risk}
                      </span>
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{cap.description}</div>
                  {cap.notes ? <div className="mt-1 text-[11px] text-muted-foreground">{cap.notes}</div> : null}
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {cap.category} · {cap.scope} · {cap.access} · Roles: {cap.defaultRoles.join(", ")}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </AdminSection>

      <AdminSection
        title="Memory / Retrieval Evaluation"
        description="Memory status, card inspection, and the future retrieval/prompt-injection evaluator."
      >
        <div className="space-y-3">
          <div className="rounded-xl border p-3">
            <div className="text-sm font-semibold">Memory System Status</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Backend route audit now checks card policy metadata, retrieval plans, profile-card gating, specific recall, and user isolation.
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              Goal: inspect what is active, style-only, content-eligible, retired, or never allowed to surface.
            </div>
          </div>

          <MemoryReviewPanel />

          <div className="rounded-xl border p-3">
            <div className="text-sm font-semibold">Memory Inspector</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Existing memory/card inspector. The new memory evaluator should be added in this section, not as another top-level Admin block.
            </div>
            <div className="mt-3">
              <CardsPanel />
            </div>
          </div>
        </div>
      </AdminSection>
    </div>
  );
}
