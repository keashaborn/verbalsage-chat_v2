"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { authFetch } from "@/lib/authFetch";

type GrantedPermission = {
  relationship_permission_id: string;
  relationship_id: string;
  grantor_user_id: string;
  grantor_display_name: string;
  grantee_user_id: string;
  grantee_display_name: string;
  permission_scope: string;
  permission_level: string;
  is_enabled: boolean;
  notes: string;
  relationship_kind: string;
  relationship_status: string;
  created_at: string;
  updated_at: string;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await authFetch(url, { cache: "no-store", ...(init || {}) });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(text || `HTTP ${r.status}`);
  }
  return (await r.json()) as T;
}

function labelScope(scope: string): string {
  return scope.replaceAll("_", " ").replaceAll(":", " / ");
}

function groupByGrantor(rows: GrantedPermission[]) {
  const map = new Map<string, GrantedPermission[]>();
  for (const row of rows) {
    const key = row.grantor_user_id;
    const existing = map.get(key) || [];
    existing.push(row);
    map.set(key, existing);
  }
  return Array.from(map.entries()).map(([grantor_user_id, permissions]) => ({
    grantor_user_id,
    grantor_display_name: permissions[0]?.grantor_display_name || "Unknown",
    relationship_kind: permissions[0]?.relationship_kind || "",
    permissions,
  }));
}

export default function LifeSwitchPeopleHelpingPage() {
  const [rows, setRows] = React.useState<GrantedPermission[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const groups = React.useMemo(() => groupByGrantor(rows), [rows]);

  async function loadGranted() {
    setLoading(true);
    setError("");
    try {
      const data = await fetchJson<GrantedPermission[]>("/api/lifeswitch/people/permissions/granted-to-me");
      setRows(data);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void loadGranted();
  }, []);

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-lg font-semibold">People I Help</div>
          <div className="mt-1 text-sm text-muted-foreground">
            People who have granted this account access. This verifies permissions before delegated plan/training views are connected.
          </div>
        </div>

        <div className="flex gap-2">
          <Link
            href="/lifeswitch/people"
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/30"
          >
            <ArrowLeft className="h-4 w-4" />
            People
          </Link>
          <button
            type="button"
            onClick={() => void loadGranted()}
            disabled={loading}
            className="rounded-md border px-3 py-2 text-sm hover:bg-muted/30 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="rounded-xl border">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <ShieldCheck className="h-4 w-4" />
          <div>
            <div className="text-sm font-semibold">Access granted to me</div>
            <div className="mt-1 text-xs text-muted-foreground">
              These permissions let this account help or view another person’s LifeSwitch data later.
            </div>
          </div>
        </div>

        <div className="grid gap-3 p-4">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading granted access…</div>
          ) : groups.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No one has granted this account access yet.
            </div>
          ) : (
            groups.map((group) => {
              const canViewPlan = group.permissions.some((p) => p.permission_scope === "plan:view");
              const canViewTraining = group.permissions.some((p) => p.permission_scope === "training:view");
              const canViewNutrition = group.permissions.some((p) => p.permission_scope === "nutrition:view");
              const canViewMeasurements = group.permissions.some((p) => p.permission_scope === "measurements:view");

              return (
              <div key={group.grantor_user_id} className="rounded-xl border p-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold">{group.grantor_display_name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Relationship: {group.relationship_kind.replaceAll("_", " ")}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canViewPlan ? (
                      <Link
                        href={`/lifeswitch/plan?target_user_id=${encodeURIComponent(group.grantor_user_id)}&target_name=${encodeURIComponent(group.grantor_display_name)}`}
                        className="rounded-md border px-3 py-2 text-xs hover:bg-muted/30"
                      >
                        View plan
                      </Link>
                    ) : null}
                    {canViewTraining ? (
                      <Link
                        href={`/lifeswitch/training/calendar?target_user_id=${encodeURIComponent(group.grantor_user_id)}&target_name=${encodeURIComponent(group.grantor_display_name)}`}
                        className="rounded-md border px-3 py-2 text-xs hover:bg-muted/30"
                      >
                        View training
                      </Link>
                    ) : null}
                    {canViewNutrition ? (
                      <Link
                        href={`/lifeswitch/nutrition/log?target_user_id=${encodeURIComponent(group.grantor_user_id)}&target_name=${encodeURIComponent(group.grantor_display_name)}`}
                        className="rounded-md border px-3 py-2 text-xs hover:bg-muted/30"
                      >
                        View nutrition
                      </Link>
                    ) : null}
                    {canViewMeasurements ? (
                      <Link
                        href={`/lifeswitch/measurements/log?target_user_id=${encodeURIComponent(group.grantor_user_id)}&target_name=${encodeURIComponent(group.grantor_display_name)}`}
                        className="rounded-md border px-3 py-2 text-xs hover:bg-muted/30"
                      >
                        View measurements
                      </Link>
                    ) : null}
                    <div className="rounded-md border px-3 py-2 text-xs text-muted-foreground">
                      {group.permissions.length} permission{group.permissions.length === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {group.permissions.map((p) => (
                    <div key={p.relationship_permission_id} className="rounded-lg border p-3">
                      <div className="text-sm font-medium">{labelScope(p.permission_scope)}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Level: {p.permission_level}
                      </div>
                      {p.notes ? (
                        <div className="mt-1 text-xs text-muted-foreground">{p.notes}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
