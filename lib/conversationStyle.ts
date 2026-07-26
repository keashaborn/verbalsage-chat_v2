export const CONVERSATION_STYLE_STORAGE_KEY = "vs_conversation_style";

export type ConversationStyle = "direct" | "natural" | "warm";

export const CONVERSATION_STYLE_OPTIONS: ReadonlyArray<{
  value: ConversationStyle;
  label: string;
  description: string;
}> = [
  {
    value: "direct",
    label: "Direct",
    description: "Concise and matter-of-fact.",
  },
  {
    value: "natural",
    label: "Natural",
    description: "Conversational and less formal.",
  },
  {
    value: "warm",
    label: "Warm",
    description: "Friendly and expressive without becoming agreeable.",
  },
];

export function normalizeConversationStyle(value: unknown): ConversationStyle {
  return value === "direct" || value === "warm" ? value : "natural";
}

export function storeConversationStyle(value: unknown): ConversationStyle {
  const style = normalizeConversationStyle(value);
  try {
    localStorage.setItem(CONVERSATION_STYLE_STORAGE_KEY, style);
  } catch {}
  return style;
}

export function readConversationStyle(): ConversationStyle {
  try {
    return normalizeConversationStyle(
      localStorage.getItem(CONVERSATION_STYLE_STORAGE_KEY),
    );
  } catch {
    return "natural";
  }
}

export function conversationStyleTtsInstructions(value: unknown): string {
  const style = normalizeConversationStyle(value);
  if (style === "direct") {
    return "Speak clearly and directly in a calm, matter-of-fact manner. Avoid theatrical emphasis.";
  }
  if (style === "warm") {
    return "Speak naturally with a calm, warm, friendly delivery. Do not sound flattering, overly enthusiastic, or theatrical.";
  }
  return "Speak naturally in a relaxed, conversational manner. Avoid sounding formal, clinical, or theatrical.";
}
