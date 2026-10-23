import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { brokeredPreviewStorage } from "./previewAuthStorage";

// Real Supabase Production Credentials for Flick
const DEFAULT_SUPABASE_URL = "https://lyuwkxfqgknaddmmigek.supabase.co";
const DEFAULT_SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5dXdreGZxZ2tuYWRkbW1pZ2VrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MDc0MjcsImV4cCI6MjA5NDI4MzQyN30.kn51u7xeL8MLJgxdvi4-dmvmFXss8Je9ASgp595ESio";

const SUPABASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL) ||
  (typeof process !== "undefined" ? process.env?.SUPABASE_URL : undefined) ||
  DEFAULT_SUPABASE_URL;

const SUPABASE_PUBLISHABLE_KEY =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY) ||
  (typeof process !== "undefined" ? process.env?.SUPABASE_PUBLISHABLE_KEY : undefined) ||
  DEFAULT_SUPABASE_KEY;

// Clear any residual mock database or demo sessions from previous demo runs
if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k) {
        if (k.startsWith("flick:mock_db:") || k.includes("flicker_demo")) {
          localStorage.removeItem(k);
        } else if (k.startsWith("sb-") && k.endsWith("-auth-token")) {
          const val = localStorage.getItem(k);
          if (val && (val.includes("flicker_demo") || val.includes("alex@flick.app"))) {
            localStorage.removeItem(k);
          }
        }
      }
    }
  } catch {}
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: brokeredPreviewStorage(),
    persistSession: true,
    autoRefreshToken: true,
  },
});
