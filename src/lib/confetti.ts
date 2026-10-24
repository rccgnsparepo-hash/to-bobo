import confetti from "canvas-confetti";

/**
 * Fires a celebratory confetti burst matching the video aesthetic (vibrant emerald, lime, gold, cyan).
 */
export function fireAuthConfetti() {
  try {
    // Left cannon
    confetti({
      particleCount: 45,
      spread: 60,
      origin: { x: 0.45, y: 0.65 },
      colors: ["#c5e863", "#10b981", "#38bdf8", "#fbbf24", "#ffffff"],
      startVelocity: 35,
      scalar: 1.1,
      ticks: 200,
    });

    // Right cannon
    confetti({
      particleCount: 45,
      spread: 60,
      origin: { x: 0.55, y: 0.65 },
      colors: ["#c5e863", "#10b981", "#38bdf8", "#fbbf24", "#ffffff"],
      startVelocity: 35,
      scalar: 1.1,
      ticks: 200,
    });
  } catch (e) {
    console.warn("[Confetti] Canvas confetti fallback:", e);
  }
}

/**
 * Stars and sparkles burst for achievements or workspace creation
 */
export function fireSparkleConfetti() {
  try {
    confetti({
      particleCount: 50,
      spread: 100,
      origin: { y: 0.6 },
      shapes: ["circle"],
      colors: ["#c5e863", "#a855f7", "#ec4899", "#3b82f6"],
      startVelocity: 28,
    });
  } catch {}
}
