export function safeJsonParse(s: string, label: string) {
  try {
    return JSON.parse(s);
  } catch {
    throw new Error(`${label} is not valid JSON`);
  }
}

export function isObjectSchema(schema: any): schema is { type: "object"; title?: string; properties?: Record<string, any>; required?: string[] } {
  return schema && schema.type === "object";
}
