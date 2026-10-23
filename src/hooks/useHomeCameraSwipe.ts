import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { triggerLightHaptic } from "@/lib/haptics";

interface SwipeOptions {
  threshold?: number; // Minimum horizontal distance in px (default: 65)
  maxDuration?: number; // Maximum swipe duration in ms (default: 450)
  disabled?: boolean;
}

/**
 * Native tactile swipe-to-navigate gesture hook between Home ("/") and Camera ("/camera").
 * - Swiping left on Home (right-to-left gesture) navigates directly to the Camera.
 * - Swiping right on Camera (left-to-right gesture) navigates back to Home.
 *
 * Includes velocity and angle filtering to avoid intercepting vertical page scrolls
 * or horizontally scrollable story bars.
 */
export function useHomeCameraSwipe(options: SwipeOptions = {}) {
  const { threshold = 65, maxDuration = 450, disabled = false } = options;
  const navigate = useNavigate();
  const location = useLocation();

  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  useEffect(() => {
    if (disabled || typeof window === "undefined") return;

    const currentPath = location.pathname;
    const isHome = currentPath === "/";
    const isCamera = currentPath === "/camera";

    if (!isHome && !isCamera) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;

      const touch = e.touches[0];
      const target = e.target as HTMLElement | null;

      // Do not intercept if user touches an input, slider, story bar, or carousel
      if (
        target?.closest("input, textarea, button, select, [data-no-swipe], .no-scrollbar, [role='slider']")
      ) {
        return;
      }

      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartRef.current || e.changedTouches.length !== 1) {
        touchStartRef.current = null;
        return;
      }

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;
      const duration = Date.now() - touchStartRef.current.time;
      touchStartRef.current = null;

      // Ensure gesture was swift and primarily horizontal
      if (duration > maxDuration) return;
      if (Math.abs(deltaX) < threshold) return;
      if (Math.abs(deltaX) < Math.abs(deltaY) * 1.6) return;

      // Haptic feedback via Capacitor Haptics
      void triggerLightHaptic();

      // Home -> Camera on Swipe Left (deltaX < -threshold)
      if (isHome && deltaX < -threshold) {
        navigate("/camera");
      }
      // Camera -> Home on Swipe Right (deltaX > threshold)
      else if (isCamera && deltaX > threshold) {
        navigate("/");
      }
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [location.pathname, navigate, threshold, maxDuration, disabled]);
}
