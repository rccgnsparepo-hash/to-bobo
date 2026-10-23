import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import THEMES, { applyThemeById, getStoredThemeId, applyTheme } from "@/lib/theme";

export function ThemeSwitcher() {
  const { user } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Initialize from localStorage or DB
    const local = getStoredThemeId();
    if (local) {
      setSelected(local);
      try { applyThemeById(local); } catch {}
    }

    // Try to fetch server-side preference when user is present
    if (user?.id) {
      (async () => {
        try {
          const { data } = await supabase.from("user_settings").select("theme").eq("user_id", user.id).maybeSingle();
          const serverTheme = (data?.theme as any)?.ui_theme ?? null;
          if (serverTheme && serverTheme !== local) {
            setSelected(serverTheme);
            applyThemeById(serverTheme);
          }
        } catch (e) {
          /* ignore */
        }
      })();
    }
  }, [user?.id]);

  const choose = (id: string) => {
    setSelected(id);
    applyThemeById(id);
  };

  const persist = async () => {
    if (!selected || !user?.id) return;
    setSaving(true);
    try {
      const { data } = await supabase.from("user_settings").select("theme").eq("user_id", user.id).maybeSingle();
      const currentTheme = (data?.theme as Record<string, unknown>) || {};
      await supabase.from("user_settings").upsert(
        {
          user_id: user.id,
          theme: { ...currentTheme, ui_theme: selected },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
    } catch (e) {
      console.warn("Theme save failed", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="font-display text-lg">Appearance</h3>
      <p className="text-sm text-muted-foreground">Choose a UI template — this will apply colors, spacing and layout hints across the app.</p>

      <div className="grid grid-cols-2 gap-3 mt-3">
        {THEMES.map((t) => (
          <button
            key={t.id}
            onClick={() => choose(t.id)}
            className={`relative rounded-xl overflow-hidden border ${selected === t.id ? "border-snap ring-2 ring-snap" : "border-border"} bg-card p-2 text-left`}
          >
            <div className="h-32 w-full bg-muted rounded-md overflow-hidden grid place-items-center">
              {/* Preview image if available */}
              {t.preview ? (
                <img src={t.preview} alt={t.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${t.vars["--bg"] || "#eee"}, ${t.vars["--card"] || "#fff"})` }} />
              )}
            </div>
            <div className="mt-2">
              <div className="flex items-center justify-between">
                <div className="font-medium">{t.name}</div>
                {selected === t.id && <div className="text-xs text-snap">Selected</div>}
              </div>
              <div className="text-xs text-muted-foreground mt-1">{t.description}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 mt-3">
        <button
          onClick={persist}
          disabled={!selected || !user}
          className="px-4 py-2 rounded-xl bg-snap text-white disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save & Apply"}
        </button>
        <button
          onClick={() => {
            // revert to default
            const first = THEMES[0];
            setSelected(first.id);
            applyTheme(first);
          }}
          className="px-3 py-2 rounded-xl bg-secondary"
        >
          Revert
        </button>
      </div>
    </div>
  );
}

export default ThemeSwitcher;
