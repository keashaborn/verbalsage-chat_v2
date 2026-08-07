export const MAX_CHAT_ATTACHMENT_BYTES = 73_728;
export const MAX_CHAT_ATTACHMENT_TOTAL_BYTES = 73_728;
export const MAX_CHAT_ATTACHMENTS = 4;
export const CHAT_ATTACHMENT_FILE_ACCEPT =
  ".txt,.md,text/plain,text/markdown";

export type ChatAttachmentMediaType = "text/plain" | "text/markdown";

export type ChatAttachmentIntakeResult =
  | { ok: true; mediaType: ChatAttachmentMediaType }
  | { ok: false; error: string };

type ChatAttachmentIntakeInput = {
  filename: string;
  byteSize: number;
  currentCount: number;
  currentTotalBytes: number;
};

const SAFE_FILENAME_RE = /^[^/\\\u0000-\u001f\u007f]{1,160}$/u;

export function formatChatAttachmentBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  return `${(value / 1024).toFixed(value < 10_240 ? 1 : 0)} KB`;
}

export function chatAttachmentMediaTypeForFilename(
  filename: string,
): ChatAttachmentMediaType | null {
  const normalized = filename.toLowerCase();
  if (normalized.endsWith(".txt")) return "text/plain";
  if (normalized.endsWith(".md")) return "text/markdown";
  return null;
}

export function validateChatAttachmentIntakeV1(
  input: ChatAttachmentIntakeInput,
): ChatAttachmentIntakeResult {
  const filename = input.filename.trim();
  if (!SAFE_FILENAME_RE.test(filename)) {
    return { ok: false, error: "The attachment filename is not supported." };
  }

  const mediaType = chatAttachmentMediaTypeForFilename(filename);
  if (!mediaType) {
    return {
      ok: false,
      error: "Only TXT and Markdown (.md) files can be attached right now.",
    };
  }

  if (!Number.isSafeInteger(input.byteSize) || input.byteSize < 1) {
    return { ok: false, error: `${filename} is empty.` };
  }
  if (input.byteSize > MAX_CHAT_ATTACHMENT_BYTES) {
    return {
      ok: false,
      error: `${filename} is ${formatChatAttachmentBytes(input.byteSize)}. Text attachments can be up to 72 KB.`,
    };
  }
  if (
    !Number.isSafeInteger(input.currentCount) ||
    input.currentCount < 0 ||
    input.currentCount >= MAX_CHAT_ATTACHMENTS
  ) {
    return {
      ok: false,
      error: "A message can include up to four text attachments.",
    };
  }
  if (
    !Number.isSafeInteger(input.currentTotalBytes) ||
    input.currentTotalBytes < 0 ||
    input.currentTotalBytes + input.byteSize >
      MAX_CHAT_ATTACHMENT_TOTAL_BYTES
  ) {
    return {
      ok: false,
      error: "Text attachments for one message can total up to 72 KB.",
    };
  }

  return { ok: true, mediaType };
}
