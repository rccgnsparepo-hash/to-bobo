export type Theme = {
  id: string;
  name: string;
  description?: string;
  preview?: string; // path to preview image
  vars: Record<string, string>;
};

export const THEMES: Theme[] = [
  {
    id: "mercedes",
    name: "Mercedes (Premium)",
    description: "Editorial luxury layout: light background, warm gold accent, spacious layout.",
    preview: "/theme-previews/mercedes.png",
    vars: {
      "--bg": "#f6f6f7",
      "--card": "#ffffff",
      "--fg": "#0f1720",
      "--muted": "#5b6b75",
      "--accent": "#c89b71",
      "--snap": "#c89b71",
      "--glass": "rgba(255,255,255,0.6)",
      "--radius": "14px",
      "--font-family": "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto",
    },
  },
  {
    id: "redx",
    name: "Red X (Futuristic)",
    description: "Cool blue background + red neon accents, center-first product hero layout.",
    preview: "/theme-previews/redx.png",
    vars: {
      "--bg": "#e7eef6",
      "--card": "#ffffff",
      "--fg": "#071126",
      "--muted": "#687992",
      "--accent": "#ff3b30",
      "--snap": "#ff3b30",
      "--glass": "rgba(255,255,255,0.5)",
      "--radius": "12px",
      "--font-family": "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto",
    },
  },
  {
    id: "visor",
    name: "Visor (Dark Promo)",
    description: "Dark, high-contrast promotional layout with bold hero and neon accent.",
    preview: "/theme-previews/visor.png",
    vars: {
      "--bg": "#060608",
      "--card": "#0f1113",
      "--fg": "#eef2f5",
      "--muted": "#98a0a8",
      "--accent": "#ffb400",
      "--snap": "#ffb400",
      "--glass": "rgba(255,255,255,0.04)",
      "--radius": "10px",
      "--font-family": "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto",
    },
  },
  {
    id: "brainwave",
    name: "Brainwave (AI Studio)",
    description: "Dark-mode AI creative studio with subtle gradients and UI depth.",
    preview: "/theme-previews/brainwave.png",
    vars: {
      "--bg": "#0b0d10",
      "--card": "#0f1317",
      "--fg": "#e6eef6",
      "--muted": "#98a0a8",
      "--accent": "#3aa3ff",
      "--snap": "#3aa3ff",
      "--glass": "rgba(255,255,255,0.03)",
      "--radius": "10px",
      "--font-family": "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto",
    },
  },
];

const STORAGE_KEY = "flick:ui-theme";

export function applyThemeById(id: string) {
  const theme = THEMES.find((t) => t.id === id) ?? THEMES[0];
  applyTheme(theme);
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {}
  window.dispatchEvent(new CustomEvent("flick:theme-changed", { detail: { theme: theme.id } }));
}

export function getStoredThemeId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function applyTheme(theme: Theme) {
  const el = document.documentElement;
  try {
    el.dataset.theme = theme.id;
    Object.entries(theme.vars).forEach(([k, v]) => el.style.setProperty(k, v));
    // Also set fallback CSS variables for known tokens
    if (theme.vars["--bg"]) el.style.setProperty("--background", theme.vars["--bg"]);
    if (theme.vars["--fg"]) el.style.setProperty("--foreground", theme.vars["--fg"]);
    if (theme.vars["--accent"]) el.style.setProperty("--accent", theme.vars["--accent"]);
    if (theme.vars["--card"]) el.style.setProperty("--card", theme.vars["--card"]);
    if (theme.vars["--font-family"]) document.body.style.fontFamily = theme.vars["--font-family"];
  } catch (e) {
    console.warn("applyTheme error", e);
  }
}

export default THEMES;
