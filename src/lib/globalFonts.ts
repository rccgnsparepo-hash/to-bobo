/**
 * Global Typography System for Flick
 * Locked to one cohesive, ultra-modern graphic sans aesthetic:
 * - Display / Headlines: Syne & Plus Jakarta Sans (punchy, high-impact, geometric)
 * - Body / Text: Plus Jakarta Sans & Inter (clean, high-legibility, modern)
 */

export const GLOBAL_FONT_CONFIG = {
  fontDisplay: '"Syne", "Plus Jakarta Sans", sans-serif',
  fontHeadline: '"Syne", "Plus Jakarta Sans", sans-serif',
  fontBody: '"Plus Jakarta Sans", "Inter", -apple-system, sans-serif',
  letterSpacingHeadline: "-0.02em",
};

export function enforceGlobalTypography() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--font-display", GLOBAL_FONT_CONFIG.fontDisplay);
  root.style.setProperty("--font-headline", GLOBAL_FONT_CONFIG.fontHeadline);
  root.style.setProperty("--font-sans", GLOBAL_FONT_CONFIG.fontBody);
  root.style.setProperty("--letter-spacing-headline", GLOBAL_FONT_CONFIG.letterSpacingHeadline);

  // Clear any legacy custom font selections
  try {
    localStorage.removeItem("flick:active_global_font");
  } catch {}
}

// Auto-enforce on load
if (typeof window !== "undefined") {
  enforceGlobalTypography();
}
