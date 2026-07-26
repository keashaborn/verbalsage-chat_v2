"use client";

import * as React from "react";
import { authFetch } from "@/lib/authFetch";
import { CardsPanel } from "@/components/admin/settings/CardsPanel";
import { MemoryReviewPanel } from "@/components/admin/settings/MemoryReviewPanel";
import { VoiceSystemHealthPanel } from "@/components/admin/settings/VoiceSystemHealthPanel";

type AdminAccess = {
  user_id: string;
  role: "owner" | "admin";
  role_label: "Owner" | "Admin";
};

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
              <div className="mt-0.5 text-xs text-muted-foreground">
                {description}
              </div>
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

export function AdminConsolePage({ access }: { access: AdminAccess }) {
  const [inspectorEnabled, setInspectorEnabled] = React.useState(false);
  const [status, setStatus] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await authFetch("/api/admin/debug_cookie", {
          method: "GET",
          cache: "no-store",
        });
        const payload = await response.json().catch(() => null);
        if (!cancelled) {
          setInspectorEnabled(Boolean(response.ok && payload?.enabled));
        }
      } catch {
        if (!cancelled) setInspectorEnabled(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function enableInspector() {
    setStatus("enabling…");
    try {
      const response = await authFetch("/api/admin/debug_cookie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
      });
      const text = await response.text().catch(() => "");
      if (!response.ok) {
        throw new Error(text || `HTTP ${response.status}`);
      }
      setInspectorEnabled(true);
      setStatus("enabled");
    } catch (error: any) {
      setStatus(`error: ${error?.message || String(error)}`);
    }
  }

  async function disableInspector() {
    setStatus("disabling…");
    try {
      const response = await authFetch("/api/admin/debug_cookie", {
        method: "DELETE",
        credentials: "same-origin",
      });
      const text = await response.text().catch(() => "");
      if (!response.ok) {
        throw new Error(text || `HTTP ${response.status}`);
      }
      setInspectorEnabled(false);
      setStatus("disabled");
    } catch (error: any) {
      setStatus(`error: ${error?.message || String(error)}`);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-muted/20 p-3">
        <div className="text-sm font-semibold">Administration</div>
        <div className="mt-1 text-xs text-muted-foreground">
          System tools, user access, and memory evaluation.
        </div>
      </div>

      <AdminSection
        title="System Tools"
        description="System health and protected prompt inspection."
      >
        <div className="space-y-3">
          <VoiceSystemHealthPanel />

          <div className="rounded-xl border p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold">Prompt Inspector</div>
                <div className="text-xs text-muted-foreground">
                  Enables prompt inspection for this browser. Authorization is
                  checked on every request.
                </div>
              </div>

              <input
                type="checkbox"
                checked={inspectorEnabled}
                onChange={(event) => {
                  if (event.target.checked) void enableInspector();
                  else void disableInspector();
                }}
                aria-label="Enable Prompt Inspector"
              />
            </div>

            {status ? (
              <div className="mt-2 text-xs text-muted-foreground">{status}</div>
            ) : null}
          </div>
        </div>
      </AdminSection>

      <AdminSection
        title="Users & Access"
        description="Manage who can administer Verbal Sage."
      >
        <div className="space-y-3">
          <div className="rounded-xl border p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Your access</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Verified by the identity service for this session.
                </div>
              </div>
              <div className="rounded-full border px-2.5 py-1 text-xs font-semibold">
                {access.role_label}
              </div>
            </div>
          </div>

          <div className="rounded-xl border p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">
                  Administrator management
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  A secure user list with Make Admin and Remove Admin actions
                  will be added in the next phase.
                </div>
              </div>
              <div className="shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                Not configured
              </div>
            </div>
          </div>

          <div className="grid gap-2 text-xs sm:grid-cols-3">
            <div className="rounded-xl border p-3">
              <div className="font-semibold">Owner</div>
              <div className="mt-1 text-muted-foreground">
                Protected authority that appoints or removes Admins.
              </div>
            </div>
            <div className="rounded-xl border p-3">
              <div className="font-semibold">Admin</div>
              <div className="mt-1 text-muted-foreground">
                Delegated access to administrative tools.
              </div>
            </div>
            <div className="rounded-xl border p-3">
              <div className="font-semibold">Member</div>
              <div className="mt-1 text-muted-foreground">
                Standard product access without administration.
              </div>
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
              Backend route audit now checks card policy metadata, retrieval
              plans, profile-card gating, specific recall, and user isolation.
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              Goal: inspect what is active, style-only, content-eligible,
              retired, or never allowed to surface.
            </div>
          </div>

          <MemoryReviewPanel />

          <div className="rounded-xl border p-3">
            <div className="text-sm font-semibold">Memory Inspector</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Existing memory/card inspector. The new memory evaluator should be
              added in this section, not as another top-level Admin block.
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
