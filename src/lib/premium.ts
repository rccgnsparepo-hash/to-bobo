import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";

export function usePremium() {
  const { user } = useAuth();
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setIsPremium(false); setLoading(false); return; }
    let alive = true;
    supabase.from("user_settings").select("is_premium").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { if (alive) { setIsPremium(!!data?.is_premium); setLoading(false); } });
    const ch = supabase
      .channel(`user-settings-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_settings", filter: `user_id=eq.${user.id}` },
        (p) => setIsPremium(!!(p.new as { is_premium?: boolean })?.is_premium));
    ch.subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [user?.id]);

  const activate = async () => {
    if (!user) return;
    await supabase.from("user_settings").upsert({
      user_id: user.id, is_premium: true, premium_since: new Date().toISOString(), updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    setIsPremium(true);
  };

  return { isPremium, loading, activate };
}