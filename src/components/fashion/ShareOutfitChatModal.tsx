import { useState, useEffect } from "react";
import { X, Send, MessageCircle, HelpCircle, Check, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { triggerLightHaptic, triggerMediumHaptic } from "@/lib/haptics";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import type { CurrentOutfit, ModelAvatar } from "@/lib/fashionData";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  outfit: CurrentOutfit;
  model: ModelAvatar;
  previewUrl: string;
  lookTitle?: string;
  stylingRule?: string;
}

interface FriendProfile {
  id: string;
  display_name: string;
  handle: string;
  avatar_url: string | null;
}

export function ShareOutfitChatModal({
  isOpen,
  onClose,
  outfit,
  model,
  previewUrl,
  lookTitle = "My Fashion Studio Look",
  stylingRule,
}: Props) {
  const { user } = useAuth();
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [askOpinion, setAskOpinion] = useState(true);
  const [customNote, setCustomNote] = useState("");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!isOpen || !user) return;
    const fetchRecentPeers = async () => {
      // 1. Fetch profiles of people the user has chatted with or existing profiles
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, handle, avatar_url")
        .neq("id", user.id)
        .limit(20);
      if (data) {
        setFriends(data as FriendProfile[]);
        if (data.length > 0 && !selectedFriendId) {
          setSelectedFriendId(data[0].id);
        }
      }
    };
    fetchRecentPeers();
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!user) {
      toast.error("Please sign in to share outfits in chat");
      return;
    }
    if (!selectedFriendId) {
      toast.error("Please select a friend to send this look to");
      return;
    }

    setIsSending(true);
    void triggerMediumHaptic();

    try {
      const payload = {
        lookTitle,
        previewUrl,
        modelId: model.id,
        stylingRule: stylingRule || "Styled in Flick Fashion Studio",
        askOpinion,
        note: customNote.trim() || (askOpinion ? "What do you think of this fit? Rate it below!" : "Check out this outfit I styled in Flick Fashion Studio!"),
        items: {
          top: outfit.top ? { id: outfit.top.id, name: outfit.top.name, priceUSD: outfit.top.priceUSD, imageUrl: outfit.top.thumbnailUrl } : undefined,
          bottom: outfit.bottom ? { id: outfit.bottom.id, name: outfit.bottom.name, priceUSD: outfit.bottom.priceUSD, imageUrl: outfit.bottom.thumbnailUrl } : undefined,
          dress: outfit.dress ? { id: outfit.dress.id, name: outfit.dress.name, priceUSD: outfit.dress.priceUSD, imageUrl: outfit.dress.thumbnailUrl } : undefined,
          shoes: outfit.shoes ? { id: outfit.shoes.id, name: outfit.shoes.name, priceUSD: outfit.shoes.priceUSD, imageUrl: outfit.shoes.thumbnailUrl } : undefined,
          accessory: outfit.accessory ? { id: outfit.accessory.id, name: outfit.accessory.name, priceUSD: outfit.accessory.priceUSD, imageUrl: outfit.accessory.thumbnailUrl } : undefined,
        },
      };

      const { error } = await supabase.from("messages").insert({
        sender_id: user.id,
        recipient_id: selectedFriendId,
        content: JSON.stringify(payload),
        media_url: previewUrl,
        media_type: "fashion_look",
      });

      if (error) throw error;

      const recipient = friends.find((f) => f.id === selectedFriendId);
      toast.success(`Outfit sent to ${recipient?.display_name || "friend"} in chat! 💬`);
      onClose();
    } catch (err) {
      toast.error((err as Error).message || "Failed to send outfit");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0 }}
        className="w-full max-w-md rounded-3xl bg-card border border-border p-5 sm:p-6 shadow-2xl space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 grid place-items-center">
              <MessageCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-display font-bold text-base text-foreground">Share to Private Chat</h3>
              <p className="text-xs text-muted-foreground">Send outfit directly to a friend on Flick</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-secondary grid place-items-center text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Outfit Preview Snippet */}
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-secondary/60 border border-border">
          <div className="w-14 h-18 rounded-xl overflow-hidden bg-background border border-border shrink-0">
            <img src={previewUrl} alt={lookTitle} className="w-full h-full object-cover" />
          </div>
          <div className="text-xs space-y-1 min-w-0">
            <div className="font-bold text-foreground truncate">{lookTitle}</div>
            <div className="text-muted-foreground text-[11px] line-clamp-2">
              {stylingRule || "Interactive 3D outfit with piece inspection"}
            </div>
          </div>
        </div>

        {/* Friend Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-foreground">Choose Friend</label>
          <div className="max-h-36 overflow-y-auto no-scrollbar space-y-1.5 p-1 rounded-2xl bg-secondary/40 border border-border">
            {friends.map((friend) => {
              const active = selectedFriendId === friend.id;
              return (
                <button
                  key={friend.id}
                  type="button"
                  onClick={() => {
                    void triggerLightHaptic();
                    setSelectedFriendId(friend.id);
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-xl transition text-left ${
                    active
                      ? "bg-rose-500/10 border border-rose-500/50"
                      : "hover:bg-secondary/70 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar url={friend.avatar_url} name={friend.display_name} size={32} />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-foreground truncate leading-tight">
                        {friend.display_name}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">@{friend.handle}</div>
                    </div>
                  </div>
                  {active && <Check className="w-4 h-4 text-rose-500 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Ask for Opinion Checkbox & Poll Prompt */}
        <div className="p-3 rounded-2xl bg-secondary/60 border border-border space-y-2">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={askOpinion}
              onChange={(e) => setAskOpinion(e.target.checked)}
              className="rounded border-border text-rose-500 focus:ring-rose-500 w-4 h-4"
            />
            <span className="text-xs font-bold text-foreground">
              Ask friend for their outfit opinion (Interactive Poll)
            </span>
          </label>
          <p className="text-[11px] text-muted-foreground pl-6">
            Renders interactive reaction buttons (🔥 Fire, 👍 Great, 👎 Pass, 💎 Iconic) in your chat!
          </p>
        </div>

        {/* Optional Custom Note */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-foreground">Add a Message</label>
          <input
            type="text"
            value={customNote}
            onChange={(e) => setCustomNote(e.target.value)}
            placeholder={askOpinion ? "Would you wear this on campus?" : "Check out this combination I made!"}
            className="w-full bg-secondary/80 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-rose-500"
          />
        </div>

        {/* Send Action */}
        <button
          type="button"
          disabled={isSending || !selectedFriendId}
          onClick={handleSend}
          className="w-full py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-xs shadow-md shadow-blue-500/20 hover:opacity-95 active:scale-95 transition flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
          <span>{isSending ? "Sending to Chat…" : "Send Outfit to Chat"}</span>
        </button>
      </motion.div>
    </div>
  );
}
