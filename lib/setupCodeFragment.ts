export type ParsedSetupCodeFragment = {
  present: boolean;
  code: string | null;
};

const SETUP_CODE_PATTERN = /^[0-9]{6,8}$/;

export function normalizeSetupCode(value: string): string {
  return value.replace(/\D+/g, "");
}

export function parseSetupCodeFragment(hash: string): ParsedSetupCodeFragment {
  const fragment = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(fragment);

  if (!params.has("setup_code")) {
    return { present: false, code: null };
  }

  const candidate = String(params.get("setup_code") || "");
  return {
    present: true,
    code: SETUP_CODE_PATTERN.test(candidate) ? candidate : null,
  };
}
