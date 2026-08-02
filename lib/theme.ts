export type VSTheme = "balanced" | "mist" | "slate";

export const DEFAULT_THEME: VSTheme = "balanced";

const LEGACY_THEME_CLASSES = [
  "dark",
  "dark-hc",
  "paper",
  "graphite",
  "carbon",
  "balanced",
  "slate",
  "mist",
];

export function normalizeThemeValue(raw: unknown): VSTheme | null {
  let value = raw;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('"')) {
      try {
        value = JSON.parse(trimmed);
      } catch {
        value = trimmed;
      }
    } else {
      value = trimmed;
    }
  }

  const theme = String(value || "")
    .trim()
    .toLowerCase();
  if (theme === "balanced") return "balanced";
  if (theme === "paper" || theme === "light" || theme === "mist") return "mist";
  if (["slate", "graphite", "dark", "carbon", "dark-hc"].includes(theme)) {
    return "slate";
  }
  return null;
}

export function readStoredTheme(): VSTheme {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    return (
      normalizeThemeValue(window.localStorage.getItem("vs_theme")) ||
      DEFAULT_THEME
    );
  } catch {
    return DEFAULT_THEME;
  }
}

export function applyTheme(theme: VSTheme) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  root.classList.remove(...LEGACY_THEME_CLASSES);
  root.dataset.theme = theme;

  if (theme === "mist") {
    root.classList.add("mist");
    root.style.colorScheme = "light";
    root.style.backgroundColor = "#f1f4f7";
  } else if (theme === "slate") {
    root.classList.add("dark", "slate");
    root.style.colorScheme = "dark";
    root.style.backgroundColor = "#171c24";
  } else {
    root.classList.add("dark", "balanced");
    root.style.colorScheme = "dark";
    root.style.backgroundColor = "#465464";
  }

  try {
    window.localStorage.setItem("vs_theme", JSON.stringify(theme));
    window.dispatchEvent(new Event("vs_theme_changed"));
  } catch {
    // Theme application must not depend on browser storage availability.
  }
}
