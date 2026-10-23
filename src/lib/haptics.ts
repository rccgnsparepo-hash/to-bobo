import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

/**
 * Safe Capacitor Haptics bridge with web vibration fallback
 */

export async function triggerLightHaptic() {
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(12);
    }
  }
}

export async function triggerMediumHaptic() {
  try {
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(25);
    }
  }
}

export async function triggerSuccessHaptic() {
  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([15, 50, 20]);
    }
  }
}
