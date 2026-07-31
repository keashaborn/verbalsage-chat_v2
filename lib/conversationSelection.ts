export type ConversationSelectionMessage = {
  role: "user" | "assistant";
  content: string;
};

export function selectAllMessageIndexes(total: number): number[] {
  const count = Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0;
  return Array.from({ length: count }, (_, index) => index);
}

export function nextMessageSelection(
  current: readonly number[],
  index: number,
  anchor: number | null,
  extend: boolean,
  total: number,
): number[] {
  const available = selectAllMessageIndexes(total);
  if (!available.includes(index)) return [...current];

  const selected = new Set(
    current.filter((candidate) => available.includes(candidate)),
  );
  if (extend && anchor != null && available.includes(anchor)) {
    const start = Math.min(anchor, index);
    const end = Math.max(anchor, index);
    for (let candidate = start; candidate <= end; candidate += 1) {
      selected.add(candidate);
    }
  } else if (selected.has(index)) {
    selected.delete(index);
  } else {
    selected.add(index);
  }

  return [...selected].sort((left, right) => left - right);
}

export function formatConversationTranscript(
  messages: readonly ConversationSelectionMessage[],
  selectedIndexes?: readonly number[],
): string {
  const selected = selectedIndexes
    ? new Set(selectedIndexes.filter(Number.isInteger))
    : null;

  return messages
    .map((message, index) => ({ message, index }))
    .filter(({ index }) => selected == null || selected.has(index))
    .map(({ message }) => {
      const content = String(message.content || "").trim();
      if (!content) return "";
      const label = message.role === "user" ? "You" : "Assistant";
      return `${label}:\n${content}`;
    })
    .filter(Boolean)
    .join("\n\n");
}
