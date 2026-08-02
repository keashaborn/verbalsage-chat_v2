"use client";

import * as React from "react";
import Link from "next/link";
import type { ReactNode } from "react";

import { SecurityPanel } from "@/components/admin/SecurityPanel";

type SectionId = "archive" | "conversation" | "account";

function PersonalSection({
  id,
  title,
  open,
  onToggle,
  children,
}: {
  id: SectionId;
  title: string;
  open: boolean;
  onToggle: (id: SectionId) => void;
  children: ReactNode;
}) {
  const panelId = `data-privacy-${id}`;

  return (
    <section>
      <button
        type="button"
        className="flex min-h-11 w-full items-center justify-between gap-3 py-4 text-left hover:bg-muted/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => onToggle(id)}
      >
        <span className="text-sm font-semibold">{title}</span>
        <span
          className={`shrink-0 text-xl text-muted-foreground transition-transform ${
            open ? "rotate-90" : ""
          }`}
          aria-hidden="true"
        >
          ›
        </span>
      </button>
      {open ? (
        <div id={panelId} className="border-t border-muted/20 py-5">
          {children}
        </div>
      ) : null}
    </section>
  );
}

function SettingsLink({ href, title }: { href: string; title: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-11 items-center justify-between gap-3 border-y border-muted/20 px-3 py-3 hover:bg-muted/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span className="text-sm font-semibold">{title}</span>
      <span
        className="shrink-0 text-lg text-muted-foreground"
        aria-hidden="true"
      >
        ›
      </span>
    </Link>
  );
}

const ARCHIVE_STATUS = [
  { label: "Personal archive", value: "Not registered" },
  { label: "Import", value: "Unavailable" },
  { label: "Semantic processing", value: "Locked" },
  { label: "Search index", value: "Not created" },
];

export function DataPrivacyPanel() {
  const [openSection, setOpenSection] = React.useState<SectionId | null>(null);

  function toggleSection(id: SectionId) {
    setOpenSection((current) => (current === id ? null : id));
  }

  return (
    <div className="divide-y divide-muted/20 border-y border-muted/20">
      <PersonalSection
        id="archive"
        title="Development History Archive"
        open={openSection === "archive"}
        onToggle={toggleSection}
      >
        <div className="space-y-5">
          <div className="divide-y divide-muted/20 border-y border-muted/20">
            {ARCHIVE_STATUS.map((status) => (
              <div
                key={status.label}
                className="flex min-h-11 items-center justify-between gap-4 py-3"
              >
                <span className="text-sm font-medium">{status.label}</span>
                <span className="text-xs font-medium text-muted-foreground">
                  {status.value}
                </span>
              </div>
            ))}
          </div>

          <p className="text-xs leading-5 text-muted-foreground">
            Historical material remains evidence of development. It cannot
            override current sources, preferences, governed Memory, or safety
            rules.
          </p>

          <div className="flex justify-end">
            <button
              type="button"
              disabled
              className="min-h-11 cursor-not-allowed rounded-md border border-muted/40 px-3 py-2 text-sm text-muted-foreground opacity-60"
            >
              Import unavailable
            </button>
          </div>
        </div>
      </PersonalSection>

      <PersonalSection
        id="conversation"
        title="Conversation & Memory Data"
        open={openSection === "conversation"}
        onToggle={toggleSection}
      >
        <SecurityPanel view="data" />
      </PersonalSection>

      <PersonalSection
        id="account"
        title="Account Profile"
        open={openSection === "account"}
        onToggle={toggleSection}
      >
        <SettingsLink href="/settings/account" title="Open Account" />
      </PersonalSection>
    </div>
  );
}
