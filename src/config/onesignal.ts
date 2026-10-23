export const ONESIGNAL_APP_ID =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_ONESIGNAL_APP_ID) ||
  "050ecfbd-c43d-453d-a578-2f3ece4649ea";

// Custom URL scheme used for deep links from notifications, e.g. flick://posts/123
// Configured in Android in AndroidManifest.xml intent-filter.
export const APP_URL_SCHEME = "flick";
