import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("chat errors and destructive actions use the theme semantic contract", () => {
  const create = read("components/assistant-ui/threadlist-sidebar.tsx");
  const list = read("components/threads/BrainsThreadList.tsx");
  const chat = read("components/threads/BrainsChatPane.tsx");

  for (const source of [create, list, chat]) {
    assert.doesNotMatch(source, /text-destructive(?:\s|\")/);
  }
  assert.match(create, /border-destructive-border bg-destructive-surface/);
  assert.match(
    list,
    /bg-destructive-surface[\s\S]*?text-destructive-foreground/,
  );
  assert.match(chat, /border-destructive-border bg-destructive-surface/);
  assert.doesNotMatch(list, /text-muted-foreground\/75/);
});

test("chat chrome protects mobile top and bottom safe areas", () => {
  const assistant = read("app/assistant.tsx");
  const sidebar = read("components/assistant-ui/threadlist-sidebar.tsx");

  assert.match(assistant, /h-\[calc\(4rem\+env\(safe-area-inset-top\)\)\]/);
  assert.match(assistant, /pt-\[env\(safe-area-inset-top\)\]/);
  assert.match(sidebar, /pt-\[env\(safe-area-inset-top\)\]/);
  assert.match(sidebar, /env\(safe-area-inset-bottom\)/);
});

test("primary chat controls retain 44 pixel phone targets", () => {
  const sidebar = read("components/ui/sidebar.tsx");
  const workspace = read("components/nav/WorkspaceMenu.tsx");
  const account = read("components/nav/AccountMenu.tsx");
  const list = read("components/threads/BrainsThreadList.tsx");

  assert.match(sidebar, /size-11 sm:size-7/);
  assert.match(workspace, /min-h-11[\s\S]*?sm:min-h-0/);
  assert.match(account, /min-h-11[\s\S]*?sm:min-h-0/);
  assert.match(list, /min-h-11 min-w-0 flex-1[\s\S]*?sm:min-h-9/);
  assert.match(list, /inline-flex size-11[\s\S]*?sm:size-8/);
  assert.ok((list.match(/min-h-11 min-w-11/g) || []).length >= 2);
});

test("an existing empty chat receives intentional guidance", () => {
  const chat = read("components/threads/BrainsChatPane.tsx");

  assert.match(chat, /!loading && msgs\.length === 0/);
  assert.match(chat, /threadId[\s\S]*?This chat is ready/);
  assert.doesNotMatch(chat, /\{!threadId && \(/);
});

test("composer and horizontally scrolling tables have accessible names", () => {
  const markdown = read("components/shared/MarkdownMessage.tsx");
  const chat = read("components/threads/BrainsChatPane.tsx");

  assert.match(markdown, /role="region"/);
  assert.match(markdown, /aria-label="Scrollable table\./);
  assert.match(markdown, /tabIndex=\{0\}/);
  assert.match(chat, /<label className="sr-only" htmlFor="chat-composer">/);
});

test("conversation title is collision-safe and waits for metadata", () => {
  const assistant = read("app/assistant.tsx");
  const title = read("components/threads/ActiveConversationTitle.tsx");

  assert.match(
    assistant,
    /md:grid-cols-\[minmax\(0,1fr\)_minmax\(0,42vw\)_minmax\(0,1fr\)\]/,
  );
  assert.doesNotMatch(assistant, /absolute left-1\/2/);
  assert.match(title, /useState<string \| null>\(null\)/);
  assert.match(title, /Loading conversation title/);
});

test("source presentation deduplicates URLs and omits empty cited sections", () => {
  const chat = read("components/threads/BrainsChatPane.tsx");

  assert.match(chat, /const deduplicateByUrl/);
  assert.match(chat, /seenUrls\.has\(source\.url\)/);
  assert.match(chat, /supportingSources\.length/);
  assert.match(chat, /\{cited\.length > 0 && \(/);
  assert.match(chat, /!cited\.length && !additionalSupporting\.length/);
});

test("narrow composer errors wrap while their actions remain usable", () => {
  const chat = read("components/threads/BrainsChatPane.tsx");

  assert.match(chat, /flex flex-wrap items-start/);
  assert.match(chat, /min-w-0 flex-1 basis-48 break-words/);
  assert.match(chat, /flex shrink-0 flex-wrap justify-end gap-2/);
});

test("chat deletion announces explicit busy feedback", () => {
  const list = read("components/threads/BrainsThreadList.tsx");

  assert.match(list, /Loader2/);
  assert.match(list, /Deleting…/);
  assert.match(list, /role="status"/);
});
