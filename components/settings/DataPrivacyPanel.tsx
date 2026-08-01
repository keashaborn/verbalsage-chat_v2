"use client";

import Link from "next/link";
import type { ReactNode } from "react";

function PersonalSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <details className="group">
      <summary className="cursor-pointer list-none py-4 hover:bg-muted/20 focus:outline-none focus-visible:bg-muted/30">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold">{title}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {description}
            </div>
          </div>
          <div
            className="shrink-0 text-xl text-muted-foreground transition-transform group-open:rotate-90"
            aria-hidden="true"
          >
            ›
          </div>
        </div>
      </summary>
      <div className="border-t border-muted/20 py-5">{children}</div>
    </details>
  );
}

function SettingsLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 border-y border-muted/20 px-3 py-3 hover:bg-muted/20"
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">
          {description}
        </span>
      </span>
      <span className="shrink-0 text-lg text-muted-foreground" aria-hidden="true">
        ›
      </span>
    </Link>
  );
}

const ARCHIVE_STATUS = [
  {
    label: "Personal archive",
    value: "Not registered",
    detail: "No personal development-history source is connected to this account.",
  },
  {
    label: "Import",
    value: "Not available yet",
    detail: "Archive upload and processing remain disabled while the service is quarantined.",
  },
  {
    label: "Semantic processing",
    value: "Locked",
    detail: "No classification, episode extraction, or historical interpretation is active.",
  },
  {
    label: "Search index",
    value: "Not created",
    detail: "No embeddings, vector collection, or archive retrieval integration exists.",
  },
];

export function DataPrivacyPanel() {
  return (
    <div>
      <div className="divide-y divide-muted/20 border-y border-muted/20">
        <PersonalSection
          title="Development History Archive"
          description="Preserve and search the history of a long-running project without treating old wording as current truth."
        >
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="max-w-2xl text-xs leading-5 text-muted-foreground">
                A personal archive can preserve how work was created, questioned,
                corrected, rejected, and refined. It remains separate from current
                instructions, governed Memory, and ordinary chat retrieval.
              </div>
              <span className="rounded-full border border-muted/50 bg-muted/30 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                Personal service unavailable
              </span>
            </div>

            <div className="grid gap-px overflow-hidden rounded-xl border border-muted/30 bg-muted/30 sm:grid-cols-2">
              {ARCHIVE_STATUS.map((status) => (
                <div key={status.label} className="bg-background p-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-semibold">{status.label}</div>
                    <span className="rounded-full border border-muted/50 bg-muted/30 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                      {status.value}
                    </span>
                  </div>
                  <div className="mt-2 text-xs leading-5 text-muted-foreground">
                    {status.detail}
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-muted/30 bg-muted/10 p-4 text-xs leading-5 text-muted-foreground">
              <div className="font-semibold text-foreground">Personal authority boundary</div>
              <p className="mt-2">
                Historical material is evidence of development. It cannot silently
                override current project sources, your current preferences, governed
                Memory, safety rules, or runtime behavior.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-muted/20 pt-4">
              <div className="max-w-xl text-xs leading-5 text-muted-foreground">
                No file selection, upload, storage, or processing occurs from this page.
              </div>
              <button
                type="button"
                disabled
                className="cursor-not-allowed rounded-lg border border-muted/40 bg-muted/20 px-3 py-2 text-xs font-semibold text-muted-foreground opacity-70"
              >
                Import archive unavailable
              </button>
            </div>
          </div>
        </PersonalSection>

        <PersonalSection
          title="Conversation & Memory Data"
          description="Open the existing authenticated export, recent-forgetting, and deletion controls."
        >
          <SettingsLink
            href="/settings/security"
            title="Open Security & Data Controls"
            description="Download chat data, forget recent conversations, or review the protected deletion controls."
          />
        </PersonalSection>

        <PersonalSection
          title="Account Profile"
          description="Review identity, product access, and registered time zone."
        >
          <SettingsLink
            href="/settings/account"
            title="Open Account Settings"
            description="Manage your display name and account-level time zone."
          />
        </PersonalSection>
      </div>

      <p className="mt-4 text-xs leading-5 text-muted-foreground">
        Additional personal data tools can be added here as they receive separate
        privacy, authorization, and retention designs.
      </p>
    </div>
  );
}
