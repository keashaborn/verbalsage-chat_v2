import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  buildInitialThreadSections,
  buildThreadSections,
} from "../lib/threadSections.ts";

type TestThread = {
  thread_id: string;
  title: string;
  updated_at: string;
  pinned: boolean;
};

function localIso(year: number, month: number, day: number, hour = 12): string {
  return new Date(year, month, day, hour).toISOString();
}

test("groups pinned chats once and organizes the remainder by activity", () => {
  const now = new Date(2026, 6, 25, 12);
  const threads: TestThread[] = [
    {
      thread_id: "pinned",
      title: "Pinned",
      updated_at: localIso(2026, 6, 25, 11),
      pinned: true,
    },
    {
      thread_id: "today-new",
      title: "Today new",
      updated_at: localIso(2026, 6, 25, 10),
      pinned: false,
    },
    {
      thread_id: "today-old",
      title: "Today old",
      updated_at: localIso(2026, 6, 25, 8),
      pinned: false,
    },
    {
      thread_id: "yesterday",
      title: "Yesterday",
      updated_at: localIso(2026, 6, 24),
      pinned: false,
    },
    {
      thread_id: "week",
      title: "Week",
      updated_at: localIso(2026, 6, 20),
      pinned: false,
    },
    {
      thread_id: "month",
      title: "Month",
      updated_at: localIso(2026, 6, 10),
      pinned: false,
    },
    {
      thread_id: "older",
      title: "Older",
      updated_at: localIso(2026, 5, 1),
      pinned: false,
    },
  ];

  const sections = buildThreadSections(threads, now);

  assert.deepEqual(
    sections.map((section) => section.label),
    [
      "Pinned",
      "Today",
      "Yesterday",
      "Previous 7 days",
      "Previous 30 days",
      "June 2026",
    ],
  );
  assert.deepEqual(
    sections
      .find((section) => section.key === "today")
      ?.threads.map((thread) => thread.thread_id),
    ["today-new", "today-old"],
  );
  assert.equal(
    sections
      .flatMap((section) => section.threads)
      .filter((thread) => thread.thread_id === "pinned").length,
    1,
  );
});

test("initial history keeps pinned and open chats visible, then limits recent chats", () => {
  const threads: TestThread[] = [
    {
      thread_id: "pinned",
      title: "Pinned",
      updated_at: localIso(2026, 6, 25, 11),
      pinned: true,
    },
    {
      thread_id: "recent-1",
      title: "Recent 1",
      updated_at: localIso(2026, 6, 25, 10),
      pinned: false,
    },
    {
      thread_id: "recent-2",
      title: "Recent 2",
      updated_at: localIso(2026, 6, 25, 9),
      pinned: false,
    },
    {
      thread_id: "recent-3",
      title: "Recent 3",
      updated_at: localIso(2026, 6, 25, 8),
      pinned: false,
    },
    {
      thread_id: "open-old",
      title: "Open old",
      updated_at: localIso(2026, 5, 1),
      pinned: false,
    },
  ];

  const sections = buildInitialThreadSections(threads, "open-old", 2);

  assert.deepEqual(
    sections.map((section) => section.label),
    ["Pinned", "Open", "Recent"],
  );
  assert.deepEqual(
    sections.flatMap((section) =>
      section.threads.map((thread) => thread.thread_id),
    ),
    ["pinned", "open-old", "recent-1", "recent-2"],
  );
});

test("places the accessible new-chat icon in the fixed sidebar header", () => {
  const sidebarSource = readFileSync(
    "components/assistant-ui/threadlist-sidebar.tsx",
    "utf8",
  );
  const listSource = readFileSync(
    "components/threads/BrainsThreadList.tsx",
    "utf8",
  );

  assert.match(sidebarSource, /MessageSquarePlus/);
  assert.match(sidebarSource, /aria-label="New chat"/);
  assert.match(sidebarSource, /<BrainsThreadList query=\{query\}/);
  assert.doesNotMatch(listSource, /<PlusIcon/);
  assert.match(listSource, /Older chats \(\$\{hiddenThreadCount\}\)/);
  assert.match(listSource, /aria-expanded=\{historyExpanded\}/);
  assert.match(listSource, /aria-current=\{isActive \? "page" : undefined\}/);
  assert.match(listSource, /vs_active_thread_metadata/);
});

test("sidebar brand marks bypass the failing image optimizer", () => {
  const sidebarSource = readFileSync(
    "components/assistant-ui/threadlist-sidebar.tsx",
    "utf8",
  );

  assert.match(sidebarSource, /src=\{brand\.iconLight\}/);
  assert.match(sidebarSource, /src=\{brand\.iconDark\}/);
  assert.equal(sidebarSource.match(/\bunoptimized\b/g)?.length, 2);
});
