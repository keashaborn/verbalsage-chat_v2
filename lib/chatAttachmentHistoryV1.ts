export type ChatAttachmentSummary = {
  id: string;
  filename: string;
  media_type: "text/plain" | "text/markdown";
  content_sha256: string;
  byte_size: number;
  processing_status: "ready" | "error" | "deleted";
  deleted_at?: string | null;
};

const MAX_ATTACHMENT_COUNT = 4;
const MAX_ATTACHMENT_BYTES = 73_728;
const MAX_WIRE_BYTES = 16_384;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256_RE = /^[0-9a-f]{64}$/;
const FILENAME_RE = /^[^\u0000-\u001f\u007f]{1,255}$/u;
const SAFE_KEYS = new Set([
  "id",
  "filename",
  "media_type",
  "content_sha256",
  "byte_size",
  "processing_status",
  "deleted_at",
]);

function skipWhitespace(value: string, start: number): number {
  let index = start;
  while (
    index < value.length &&
    (value[index] === " " ||
      value[index] === "\n" ||
      value[index] === "\r" ||
      value[index] === "\t")
  ) {
    index += 1;
  }
  return index;
}

function scanJsonString(
  value: string,
  start: number,
): { decoded: string; next: number } | null {
  if (value[start] !== '"') return null;
  let index = start + 1;
  while (index < value.length) {
    const code = value.charCodeAt(index);
    if (code < 0x20) return null;
    if (value[index] === '"') {
      const token = value.slice(start, index + 1);
      try {
        const decoded = JSON.parse(token);
        return typeof decoded === "string"
          ? { decoded, next: index + 1 }
          : null;
      } catch {
        return null;
      }
    }
    if (value[index] === "\\") {
      index += 1;
      if (index >= value.length) return null;
      if (value[index] === "u") {
        if (!/^[0-9a-fA-F]{4}$/.test(value.slice(index + 1, index + 5))) {
          return null;
        }
        index += 4;
      } else if (!'"\\/bfnrt'.includes(value[index])) {
        return null;
      }
    }
    index += 1;
  }
  return null;
}

function scanFlatValue(value: string, start: number): number | null {
  if (value[start] === '"') return scanJsonString(value, start)?.next ?? null;
  if (value.startsWith("null", start)) return start + 4;
  const number = value
    .slice(start)
    .match(/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/);
  return number ? start + number[0].length : null;
}

function scanFlatObject(value: string, start: number): number | null {
  if (value[start] !== "{") return null;
  const keys = new Set<string>();
  let index = skipWhitespace(value, start + 1);
  if (value[index] === "}") return index + 1;

  while (index < value.length) {
    const key = scanJsonString(value, index);
    if (!key || keys.has(key.decoded)) return null;
    keys.add(key.decoded);
    index = skipWhitespace(value, key.next);
    if (value[index] !== ":") return null;
    index = skipWhitespace(value, index + 1);
    const valueEnd = scanFlatValue(value, index);
    if (valueEnd == null) return null;
    index = skipWhitespace(value, valueEnd);
    if (value[index] === "}") return index + 1;
    if (value[index] !== ",") return null;
    index = skipWhitespace(value, index + 1);
  }
  return null;
}

function isUnambiguousFlatObjectArray(value: string): boolean {
  let index = skipWhitespace(value, 0);
  if (value[index] !== "[") return false;
  index = skipWhitespace(value, index + 1);
  if (value[index] === "]") {
    return skipWhitespace(value, index + 1) === value.length;
  }

  while (index < value.length) {
    const objectEnd = scanFlatObject(value, index);
    if (objectEnd == null) return false;
    index = skipWhitespace(value, objectEnd);
    if (value[index] === "]") {
      return skipWhitespace(value, index + 1) === value.length;
    }
    if (value[index] !== ",") return false;
    index = skipWhitespace(value, index + 1);
  }
  return false;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeAttachment(value: unknown): ChatAttachmentSummary | null {
  if (!isPlainRecord(value)) return null;
  const keys = Object.keys(value);
  if (
    keys.length !== SAFE_KEYS.size ||
    keys.some((key) => !SAFE_KEYS.has(key))
  ) {
    return null;
  }

  const id = value.id;
  const filename = value.filename;
  const mediaType = value.media_type;
  const contentSha256 = value.content_sha256;
  const byteSize = value.byte_size;
  const processingStatus = value.processing_status;
  const deletedAt = value.deleted_at;

  if (typeof id !== "string" || !UUID_RE.test(id)) return null;
  if (typeof filename !== "string" || !FILENAME_RE.test(filename)) return null;
  if (mediaType !== "text/plain" && mediaType !== "text/markdown") return null;
  if (typeof contentSha256 !== "string" || !SHA256_RE.test(contentSha256)) {
    return null;
  }
  if (
    typeof byteSize !== "number" ||
    !Number.isInteger(byteSize) ||
    byteSize < 1 ||
    byteSize > MAX_ATTACHMENT_BYTES
  ) {
    return null;
  }
  if (
    processingStatus !== "ready" &&
    processingStatus !== "error" &&
    processingStatus !== "deleted"
  ) {
    return null;
  }
  let normalizedDeletedAt: string | null;
  if (processingStatus === "deleted") {
    if (
      typeof deletedAt !== "string" ||
      deletedAt.length > 64 ||
      !Number.isFinite(Date.parse(deletedAt))
    ) {
      return null;
    }
    normalizedDeletedAt = deletedAt;
  } else {
    if (deletedAt !== null) return null;
    normalizedDeletedAt = null;
  }

  return {
    id,
    filename,
    media_type: mediaType,
    content_sha256: contentSha256,
    byte_size: byteSize,
    processing_status: processingStatus,
    deleted_at: normalizedDeletedAt,
  };
}

export function normalizeChatAttachmentHistoryV1(
  wireValue: unknown,
): ChatAttachmentSummary[] {
  let parsed: unknown = wireValue;
  if (typeof wireValue === "string") {
    if (
      wireValue.length === 0 ||
      new TextEncoder().encode(wireValue).byteLength > MAX_WIRE_BYTES ||
      !isUnambiguousFlatObjectArray(wireValue)
    ) {
      return [];
    }
    try {
      parsed = JSON.parse(wireValue);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsed) || parsed.length > MAX_ATTACHMENT_COUNT) return [];
  const attachments: ChatAttachmentSummary[] = [];
  const ids = new Set<string>();
  for (const value of parsed) {
    const attachment = normalizeAttachment(value);
    if (!attachment || ids.has(attachment.id)) return [];
    ids.add(attachment.id);
    attachments.push(attachment);
  }
  return attachments;
}
