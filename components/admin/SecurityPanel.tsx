"use client";

import { authFetch } from "@/lib/authFetch";
import * as React from "react";

function Group({
  title,
  children,
  footer,
}: {
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="overflow-hidden rounded-xl border">
        <div className="divide-y">{children}</div>
      </div>
      {footer != null && <div className="px-1 text-xs text-muted-foreground">{footer}</div>}
    </div>
  );
}

function Row({
  left,
  right,
  children,
}: {
  left: React.ReactNode;
  right?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 text-sm">{left}</div>
        {right != null && <div className="shrink-0">{right}</div>}
      </div>
      {children != null && <div className="mt-2">{children}</div>}
    </div>
  );
}

function ActionRow({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="w-full px-3 py-2 text-left text-sm hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60"
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
}


function forgetLabel(minutes: number) {
  if (minutes === 15) return "Last 15 minutes";
  if (minutes === 60) return "Last 1 hour";
  if (minutes === 240) return "Last 4 hours";
  if (minutes === 1440) return "Last 24 hours";
  return `Last ${minutes} minutes`;
}

export function SecurityPanel({ onDone }: { onDone: () => void }) {
  const [deleteConfirm, setDeleteConfirm] = React.useState("");
  const [deletingAll, setDeletingAll] = React.useState(false);
  const [exportBusy, setExportBusy] = React.useState(false);

  const [forgetMinutes, setForgetMinutes] = React.useState<number>(60);
  const [forgetBusy, setForgetBusy] = React.useState(false);

  async function downloadExport() {
    setExportBusy(true);
    try {
      const r = await authFetch("/api/admin/export", { method: "GET", cache: "no-store" });
      if (!r.ok) throw new Error(await r.text());

      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");

      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      a.href = url;
      a.download = `verbalsage-export-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e?.message || String(e));
    } finally {
      setExportBusy(false);
    }
  }

  async function deleteAll() {
    const ok = window.confirm("Final confirmation: delete ALL your data?");
    if (!ok) return;

    setDeletingAll(true);
    try {
      const r = await authFetch("/api/admin/delete_all", { method: "DELETE" });
      if (!r.ok) throw new Error(await r.text());
      onDone();
    } catch (e: any) {
      alert(e?.message || String(e));
    } finally {
      setDeletingAll(false);
      setDeleteConfirm("");
    }
  }

  async function forgetRecent() {
    const ok = window.confirm(`Forget ${forgetLabel(forgetMinutes)}?`);
    if (!ok) return;

    setForgetBusy(true);
    try {
      const r = await authFetch(`/api/admin/forget_recent?minutes=${encodeURIComponent(String(forgetMinutes))}`, {
        method: "DELETE",
      });
      if (!r.ok) throw new Error(await r.text());
      onDone();
    } catch (e: any) {
      alert(e?.message || String(e));
    } finally {
      setForgetBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground">
        Operator tools: export, forget recent, and hard delete. These affect your backend data immediately.
      </div>

      <Group title="Export" footer={<>Downloads threads + transcript + latest cards as JSON.</>}>
        <ActionRow label={exportBusy ? "Preparing export…" : "Download export JSON"} disabled={exportBusy} onClick={downloadExport} />
      </Group>

      <Group title="Forget recent" footer={<>Deletes recent transcript rows and matching Qdrant points.</>}>
        <Row
          left="Range"
          right={
            <select
              className="w-[210px] rounded-lg border bg-background px-2 py-1.5 text-sm"
              value={forgetMinutes}
              onChange={(e) => setForgetMinutes(Number(e.target.value))}
            >
              <option value={15}>Last 15 minutes</option>
              <option value={60}>Last 1 hour</option>
              <option value={240}>Last 4 hours</option>
              <option value={1440}>Last 24 hours</option>
            </select>
          }
        />
        <ActionRow
          label={forgetBusy ? "Forgetting…" : "Forget now"}
          disabled={forgetBusy}
          onClick={forgetRecent}
        />
      </Group>

      <Group
        title="Delete all data"
        footer={
          <>
            Removes everything for your user. This is destructive.
          </>
        }
      >
        <Row left={<>Type <span className="font-semibold">DELETE ALL</span> to confirm</>}>
          <input
            className="mt-2 w-full rounded-lg border bg-background px-2 py-2 text-sm outline-none"
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder="DELETE ALL"
          />
        </Row>

        <ActionRow
          label={deletingAll ? "Deleting…" : "Delete all my data"}
          disabled={deleteConfirm !== "DELETE ALL" || deletingAll}
          onClick={deleteAll}
        />
      </Group>
    </div>
  );
}
