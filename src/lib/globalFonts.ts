/**
 * Global Typography System for Flick
 * Locked to Monkisa from the Curated Typography Library:
 * - Display / Headlines: Monkisa & Righteous (bold, Art Deco, organic rounded geometric display)
 * - Body / Text: Plus Jakarta Sans & Inter (clean, high-legibility, modern)
 */

export const GLOBAL_FONT_CONFIG = {
  fontDisplay: '"Monkisa", "Righteous", "Dela Gothic One", "Syne", sans-serif',
  fontHeadline: '"Monkisa", "Righteous", "Dela Gothic One", "Syne", sans-serif',
  fontBody: '"Plus Jakarta Sans", "Inter", -apple-system, sans-serif',
  letterSpacingHeadline: "-0.01em",
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
