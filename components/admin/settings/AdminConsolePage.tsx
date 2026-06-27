"use client";

import { authFetch } from "@/lib/authFetch";
import * as React from "react";
import { CardsPanel } from "@/components/admin/settings/CardsPanel";
import { VANTAGE_CONTROL_REGISTRY } from "@/components/admin/settings/vantage/controlRegistry";
import { CAPABILITY_REGISTRY, PERMISSION_ROLES } from "@/components/admin/settings/permissions/permissionRegistry";

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

export function AdminConsolePage() {
  const [inspectorEnabled, setInspectorEnabled] = React.useState(false);
  const [status, setStatus] = React.useState("");

  const stableControls = VANTAGE_CONTROL_REGISTRY.filter((c) => c.status === "stable").length;
  const experimentalControls = VANTAGE_CONTROL_REGISTRY.filter((c) => c.status === "experimental").length;
  const futureControls = VANTAGE_CONTROL_REGISTRY.filter((c) => c.status === "future").length;
  const userVisibleControls = VANTAGE_CONTROL_REGISTRY.filter((c) => c.audience === "user").length;
  const adminControls = VANTAGE_CONTROL_REGISTRY.filter((c) => c.audience === "admin").length;
  const criticalCapabilities = CAPABILITY_REGISTRY.filter((c) => c.risk === "critical").length;
  const backendEnforcedCapabilities = CAPABILITY_REGISTRY.filter((c) => c.backendEnforced).length;
  const capabilityCategories = Array.from(new Set(CAPABILITY_REGISTRY.map((c) => c.category))).length;

  React.useEffect(() => {
    setInspectorEnabled(hasCookie("vs_debug_token"));
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
          System tools for inspection, diagnostics, memory/card review, and future administrative controls.
        </div>
      </div>

      <div className="space-y-2">
        <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Inspection
        </div>

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
      </div>

      <div className="space-y-2">
        <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Diagnostics
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

      <div className="space-y-2">
        <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Vantage Controls
        </div>

        <div className="rounded-xl border p-3">
          <div className="text-sm font-semibold">Control Registry</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Read-only inventory of Vantage levers. Later this becomes the admin control surface for visibility, editability, and server-side enforcement.
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

          <div className="mt-3 rounded-lg border p-3">
            <div className="text-sm font-semibold">Permissions</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Read-only capability registry for roles, admin tools, Assistant Profile levers, memory tools, diagnostics, account data, and LifeSwitch sharing.
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
            </div>

            <div className="mt-2 text-xs text-muted-foreground">
              Categories: {capabilityCategories}. Future rule: frontend visibility is convenience; backend enforcement is the security boundary.
            </div>

            <div className="mt-3 max-h-52 overflow-auto rounded-lg border">
              <div className="divide-y">
                {CAPABILITY_REGISTRY.map((cap) => (
                  <div key={cap.key} className="px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium">{cap.label}</div>
                      <div className="shrink-0 text-[11px] uppercase tracking-wide text-muted-foreground">
                        {cap.category} · {cap.access} · {cap.risk}
                      </div>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{cap.description}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      Roles: {cap.defaultRoles.join(", ")} · Backend: {cap.backendEnforced ? "yes" : "no"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Memory System
        </div>

        <div className="rounded-xl border p-3">
          <div className="text-sm font-semibold">Memory System Status</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Placeholder for the memory architecture audit: Qdrant memory_raw, Postgres Vantage cards, derived profiles, retrieval, feedback, and prompt injection.
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            Goal: keep valuable memory layers, harden active systems, and retire or gate redundant/noisy legacy paths.
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Memory Cards
        </div>

        <CardsPanel />
      </div>
    </div>
  );
}
