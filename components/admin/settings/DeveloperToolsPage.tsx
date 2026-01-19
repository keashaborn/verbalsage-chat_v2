"use client";

import * as React from "react";
import { CardsPanel } from "@/components/admin/settings/CardsPanel";

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

export function DeveloperToolsPage() {
  const [inspectorEnabled, setInspectorEnabled] = React.useState(false);
  const [status, setStatus] = React.useState("");

  React.useEffect(() => {
    setInspectorEnabled(hasCookie("vs_debug_token"));
  }, []);

  async function enableInspector() {
    setStatus("enabling…");
    try {
      const r = await fetch("/api/admin/debug_cookie", {
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
    <div className="space-y-3">
      <div className="rounded-xl border p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold">Inspector</div>
            <div className="text-xs text-muted-foreground">
              Enables prompt inspection for this browser (cookie <code>vs_debug_token</code>).
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
            <div className="text-sm font-semibold">Diagnostics</div>
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

      <CardsPanel />
    </div>
  );
}
