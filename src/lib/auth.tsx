import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
};

type AuthCtx = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isOffline: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const OFFLINE_SESSION_KEY = "flick:offline_auth_session";
const OFFLINE_PROFILE_KEY = "flick:offline_auth_profile";

function getCachedOfflineSession(): Session | null {
  try {
    const raw = localStorage.getItem(OFFLINE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (parsed && parsed.user && parsed.user.id) {
      return parsed;
    }
  } catch {}
  return null;
}

function getCachedOfflineProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(OFFLINE_PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Profile;
  } catch {}
  return null;
}

function saveCachedOfflineSession(s: Session | null) {
  try {
    if (s && s.user) {
      localStorage.setItem(OFFLINE_SESSION_KEY, JSON.stringify(s));
    } else {
      localStorage.removeItem(OFFLINE_SESSION_KEY);
    }
  } catch {}
}

function saveCachedOfflineProfile(p: Profile | null) {
  try {
    if (p && p.id) {
      localStorage.setItem(OFFLINE_PROFILE_KEY, JSON.stringify(p));
    } else {
      localStorage.removeItem(OFFLINE_PROFILE_KEY);
    }
  } catch {}
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Initialize synchronously with cached offline credentials so cold start is never signed out
  const [session, setSession] = useState<Session | null>(getCachedOfflineSession);
  const [profile, setProfile] = useState<Profile | null>(getCachedOfflineProfile);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false
  );

  const loadProfile = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", uid)
        .maybeSingle();

      if (!error && data) {
        const prof = data as Profile;
        setProfile(prof);
        saveCachedOfflineProfile(prof);
        return;
      }
    } catch {
      // Offline fallback
    }

    // Preserve cached profile if network query fails
    const cached = getCachedOfflineProfile();
    if (cached && cached.id === uid) {
      setProfile(cached);
    }
  };

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // 1. Listen for Supabase auth state changes
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, s) => {
      if (s?.user) {
        setSession(s);
        saveCachedOfflineSession(s);
        setTimeout(() => loadProfile(s.user.id), 0);
      } else if (event === "SIGNED_OUT") {
        // Only clear if the user explicitly performed sign-out or session was revoked
        const manualSignout = sessionStorage.getItem("flick:manual_signout") === "1";
        if (manualSignout || navigator.onLine) {
          sessionStorage.removeItem("flick:manual_signout");
          setSession(null);
          setProfile(null);
          saveCachedOfflineSession(null);
          saveCachedOfflineProfile(null);
        } else {
          // If offline and Supabase emitted SIGNED_OUT due to failed network refresh, retain cached session
          const cached = getCachedOfflineSession();
          if (cached) {
            setSession(cached);
            setProfile(getCachedOfflineProfile());
          }
        }
      }
    });

    // 2. Fetch session on app boot
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (data.session) {
          setSession(data.session);
          saveCachedOfflineSession(data.session);
          if (data.session.user) {
            loadProfile(data.session.user.id);
          }
        } else {
          // If Supabase returned no session, but we have a valid offline session and are offline or in app
          const cached = getCachedOfflineSession();
          if (cached) {
            setSession(cached);
            const cachedP = getCachedOfflineProfile();
            if (cachedP) setProfile(cachedP);
          }
        }
      })
      .catch(() => {
        // If network error occurred, keep cached offline session
        const cached = getCachedOfflineSession();
        if (cached) {
          setSession(cached);
          const cachedP = getCachedOfflineProfile();
          if (cachedP) setProfile(cachedP);
        }
      })
      .finally(() => {
        setLoading(false);
      });

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      sessionStorage.setItem("flick:manual_signout", "1");
      saveCachedOfflineSession(null);
      saveCachedOfflineProfile(null);
      setSession(null);
      setProfile(null);
      await supabase.auth.signOut();
    } catch {
      // Ignored
    } finally {
      sessionStorage.removeItem("flick:manual_signout");
      window.location.replace("/auth");
    }
  };

  const refreshProfile = async () => {
    if (session?.user) {
      await loadProfile(session.user.id);
    }
  };

  return (
    <Ctx.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        loading,
        isOffline,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
