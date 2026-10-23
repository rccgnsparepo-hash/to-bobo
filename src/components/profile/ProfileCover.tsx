import { useState, useRef, useEffect } from "react";
import { Camera, Image as ImageIcon, Sparkles, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export interface CoverTheme {
  id: string;
  name: string;
  gradient: string;
  accent: string;
}

export const COVER_PRESETS: CoverTheme[] = [
  {
    id: "emerald-pulse",
    name: "Emerald Pulse",
    gradient: "linear-gradient(135deg, #022c22 0%, #064e3b 45%, #10b981 100%)",
    accent: "#10b981",
  },
  {
    id: "cyber-neon",
    name: "Cyberpunk Neon",
    gradient: "linear-gradient(135deg, #1e1b4b 0%, #4c1d95 45%, #06b6d4 100%)",
    accent: "#06b6d4",
  },
  {
    id: "method-rose",
    name: "Method Rose Flare",
    gradient: "linear-gradient(135deg, #18181b 0%, #3f101d 50%, #e11d48 100%)",
    accent: "#e11d48",
  },
  {
    id: "sunset-glow",
    name: "Sunset Ember",
    gradient: "linear-gradient(135deg, #450a0a 0%, #701a75 50%, #f59e0b 100%)",
    accent: "#f59e0b",
  },
  {
    id: "flick-lime",
    name: "Flick Star Lime",
    gradient: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #c5e863 100%)",
    accent: "#c5e863",
  },
];

interface ProfileCoverProps {
  userId?: string;
  isEditable?: boolean;
}

export function ProfileCover({ userId, isEditable = false }: ProfileCoverProps) {
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverPreset, setCoverPreset] = useState<CoverTheme>(COVER_PRESETS[0]);
  const [modalOpen, setModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const storageKey = userId ? `flick:profile_cover:${userId}` : null;

  useEffect(() => {
    if (!storageKey) return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        if (saved.startsWith("preset:")) {
          const presetId = saved.replace("preset:", "");
          const match = COVER_PRESETS.find((p) => p.id === presetId);
          if (match) {
            setCoverPreset(match);
            setCoverUrl(null);
          }
        } else {
          setCoverUrl(saved);
        }
      }
    } catch {}

    // Cloud database sync across all user devices (tab, laptop, web)
    if (userId) {
      let alive = true;
      supabase
        .from("user_settings")
        .select("theme")
        .eq("user_id", userId)
        .maybeSingle()
        .then(({ data }) => {
          if (!alive || !data) return;
          const themeObj = (data.theme as Record<string, unknown>) || {};
          if (themeObj.cover_url && typeof themeObj.cover_url === "string") {
            setCoverUrl(themeObj.cover_url);
            localStorage.setItem(storageKey, themeObj.cover_url);
          } else if (themeObj.cover_preset && typeof themeObj.cover_preset === "string") {
            const match = COVER_PRESETS.find((p) => p.id === themeObj.cover_preset);
            if (match) {
              setCoverPreset(match);
              setCoverUrl(null);
              localStorage.setItem(storageKey, `preset:${match.id}`);
            }
          }
        });

      return () => {
        alive = false;
      };
    }
  }, [storageKey, userId]);

  const handleSelectPreset = async (preset: CoverTheme) => {
    setCoverPreset(preset);
    setCoverUrl(null);
    if (storageKey) {
      localStorage.setItem(storageKey, `preset:${preset.id}`);
    }
    if (userId) {
      try {
        const { data } = await supabase.from("user_settings").select("theme").eq("user_id", userId).maybeSingle();
        const curTheme = (data?.theme as Record<string, unknown>) || {};
        await supabase.from("user_settings").upsert({
          user_id: userId,
          theme: { ...curTheme, cover_url: null, cover_preset: preset.id } as never,
          updated_at: new Date().toISOString(),
        });
      } catch (err) {
        console.warn("Cover preset sync warning:", err);
      }
    }
    toast.success(`Applied ${preset.name} cover`);
    setModalOpen(false);
  };

  const handleUploadCover = async (file: File) => {
    if (!userId) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Cover image must be under 8MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${userId}/cover-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("media")
        .upload(path, file, { contentType: file.type, upsert: true });

      if (uploadErr) {
        // Fallback to local data URL if storage bucket fails
        const reader = new FileReader();
        reader.onload = async () => {
          const dataUrl = reader.result as string;
          setCoverUrl(dataUrl);
          if (storageKey) localStorage.setItem(storageKey, dataUrl);
          if (userId) {
            try {
              const { data } = await supabase.from("user_settings").select("theme").eq("user_id", userId).maybeSingle();
              const curTheme = (data?.theme as Record<string, unknown>) || {};
              await supabase.from("user_settings").upsert({
                user_id: userId,
                theme: { ...curTheme, cover_url: dataUrl, cover_preset: null } as never,
                updated_at: new Date().toISOString(),
              });
            } catch {}
          }
          toast.success("Cover photo updated!");
        };
        reader.readAsDataURL(file);
      } else {
        const url = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
        setCoverUrl(url);
        if (storageKey) localStorage.setItem(storageKey, url);
        if (userId) {
          try {
            const { data } = await supabase.from("user_settings").select("theme").eq("user_id", userId).maybeSingle();
            const curTheme = (data?.theme as Record<string, unknown>) || {};
            await supabase.from("user_settings").upsert({
              user_id: userId,
              theme: { ...curTheme, cover_url: url, cover_preset: null } as never,
              updated_at: new Date().toISOString(),
            });
          } catch {}
        }
        toast.success("Cover photo synced across devices!");
      }
    } catch (err) {
      console.warn("Cover upload fallback:", err);
    } finally {
      setUploading(false);
      setModalOpen(false);
    }
  };

  return (
    <div className="relative w-full h-44 sm:h-56 md:h-64 overflow-hidden rounded-b-3xl border-b border-border shadow-inner">
      {/* Background Graphic / Image */}
      {coverUrl ? (
        <img
          src={coverUrl}
          alt="Profile cover banner"
          className="w-full h-full object-cover object-center"
        />
      ) : (
        <div
          className="w-full h-full relative"
          style={{ background: coverPreset.gradient }}
        >
          {/* Subtle geometric pattern overlay */}
          <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(circle at 25px 25px, white 2%, transparent 0%), radial-gradient(circle at 75px 75px, white 2%, transparent 0%)",
              backgroundSize: "100px 100px",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-black/20" />
        </div>
      )}

      {/* Edit Cover Trigger */}
      {isEditable && (
        <button
          onClick={() => setModalOpen(true)}
          className="absolute top-4 right-4 z-10 px-3 py-1.5 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md text-white text-xs font-bold border border-white/20 flex items-center gap-1.5 shadow-lg transition"
        >
          <Camera className="w-3.5 h-3.5 text-snap" />
          <span>Edit Cover</span>
        </button>
      )}

      {/* Cover Customizer Modal */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-card border border-border rounded-3xl p-5 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-snap/20 text-snap grid place-items-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">Customize Profile Cover</h3>
                    <p className="text-[11px] text-muted-foreground">Pick a gradient theme or upload an image</p>
                  </div>
                </div>
                <button
                  onClick={() => setModalOpen(false)}
                  className="p-1 rounded-full hover:bg-secondary text-muted-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Upload custom image */}
              <div className="border border-dashed border-border hover:border-snap/60 rounded-2xl p-4 text-center cursor-pointer bg-secondary/30 transition">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => e.target.files?.[0] && handleUploadCover(e.target.files[0])}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full flex flex-col items-center gap-1.5"
                >
                  <ImageIcon className="w-6 h-6 text-snap" />
                  <span className="text-xs font-bold">
                    {uploading ? "Uploading cover..." : "Upload Custom Photo"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">JPG, PNG, WebP up to 8MB</span>
                </button>
              </div>

              {/* Preset Gradients */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Preset Colorways
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {COVER_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => handleSelectPreset(preset)}
                      className="p-2.5 rounded-2xl border border-border hover:border-white/30 text-left flex items-center gap-2.5 transition overflow-hidden group"
                    >
                      <div
                        className="w-8 h-8 rounded-xl shrink-0 shadow"
                        style={{ background: preset.gradient }}
                      />
                      <span className="text-xs font-semibold truncate flex-1">{preset.name}</span>
                      {!coverUrl && coverPreset.id === preset.id && (
                        <Check className="w-4 h-4 text-snap shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
