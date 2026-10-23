import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    // The app shell's main viewport is the scroll container; fall back to the window.
    const vp = document.querySelector<HTMLElement>("[data-app-viewport]");
    if (vp) vp.scrollTo({ top: 0, left: 0 });
    window.scrollTo({ top: 0, left: 0 });
  }, [pathname]);
  return null;
}