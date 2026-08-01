export type ThreadSectionItem = {
  updated_at: string;
  pinned?: boolean;
};

export type ThreadNavigationItem = ThreadSectionItem & {
  thread_id: string;
};

export type ThreadSection<T extends ThreadSectionItem> = {
  key: string;
  label: string;
  threads: T[];
};

function timestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function startOfLocalDay(date: Date, dayOffset = 0): number {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + dayOffset,
  ).getTime();
}

export function buildThreadSections<T extends ThreadSectionItem>(
  threads: readonly T[],
  now = new Date(),
): ThreadSection<T>[] {
  const sorted = [...threads].sort(
    (left, right) => timestamp(right.updated_at) - timestamp(left.updated_at),
  );
  const pinned = sorted.filter((thread) => thread.pinned);
  const unpinned = sorted.filter((thread) => !thread.pinned);

  const todayStart = startOfLocalDay(now);
  const yesterdayStart = startOfLocalDay(now, -1);
  const previousSevenDaysStart = startOfLocalDay(now, -7);
  const previousThirtyDaysStart = startOfLocalDay(now, -30);

  const today: T[] = [];
  const yesterday: T[] = [];
  const previousSevenDays: T[] = [];
  const previousThirtyDays: T[] = [];
  const olderByMonth = new Map<string, ThreadSection<T>>();

  for (const thread of unpinned) {
    const updatedAt = timestamp(thread.updated_at);

    if (updatedAt >= todayStart) {
      today.push(thread);
    } else if (updatedAt >= yesterdayStart) {
      yesterday.push(thread);
    } else if (updatedAt >= previousSevenDaysStart) {
      previousSevenDays.push(thread);
    } else if (updatedAt >= previousThirtyDaysStart) {
      previousThirtyDays.push(thread);
    } else {
      const updatedDate = updatedAt > 0 ? new Date(updatedAt) : null;
      const monthKey = updatedDate
        ? `${updatedDate.getFullYear()}-${String(
            updatedDate.getMonth() + 1,
          ).padStart(2, "0")}`
        : "older";
      const monthLabel = updatedDate
        ? new Intl.DateTimeFormat("en-US", {
            month: "long",
            year: "numeric",
          }).format(updatedDate)
        : "Older";
      const section = olderByMonth.get(monthKey) || {
        key: `month-${monthKey}`,
        label: monthLabel,
        threads: [],
      };
      section.threads.push(thread);
      olderByMonth.set(monthKey, section);
    }
  }

  const sections: ThreadSection<T>[] = [];
  const addSection = (key: string, label: string, items: T[]) => {
    if (items.length) sections.push({ key, label, threads: items });
  };

  addSection("pinned", "Pinned", pinned);
  addSection("today", "Today", today);
  addSection("yesterday", "Yesterday", yesterday);
  addSection("previous-seven-days", "Previous 7 days", previousSevenDays);
  addSection("previous-thirty-days", "Previous 30 days", previousThirtyDays);
  sections.push(...olderByMonth.values());

  return sections;
}

export function buildInitialThreadSections<T extends ThreadNavigationItem>(
  threads: readonly T[],
  activeThreadId: string | null,
  recentLimit = 5,
): ThreadSection<T>[] {
  const sorted = [...threads].sort(
    (left, right) => timestamp(right.updated_at) - timestamp(left.updated_at),
  );
  const pinned = sorted.filter((thread) => thread.pinned);
  const active = sorted.filter(
    (thread) => !thread.pinned && thread.thread_id === activeThreadId,
  );
  const recent = sorted
    .filter((thread) => !thread.pinned && thread.thread_id !== activeThreadId)
    .slice(0, Math.max(0, recentLimit));

  const sections: ThreadSection<T>[] = [];
  if (pinned.length) {
    sections.push({ key: "pinned", label: "Pinned", threads: pinned });
  }
  if (active.length) {
    sections.push({ key: "open", label: "Open", threads: active });
  }
  if (recent.length) {
    sections.push({ key: "recent", label: "Recent", threads: recent });
  }

  return sections;
}
