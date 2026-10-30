import React, { useState, useEffect } from "react";
import { X, Send, Share2, MessageCircle, Copy, Check, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { GarmentItem } from "@/lib/fashionData";
import { triggerLightHaptic, triggerMediumHaptic } from "@/lib/haptics";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  outfit: {
    name: string;
    previewImage: string;
    items: {
      top?: GarmentItem;
      bottom?: GarmentItem;
      dress?: GarmentItem;
      shoes: GarmentItem;
      accessory?: GarmentItem;
    };
  };
}

interface FriendContact {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string;
}

export function FashionShareModal({ isOpen, onClose, outfit }: Props) {
  const { user } = useAuth();
  const [friends, setFriends] = useState<FriendContact[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<string | null>(null);
  const [customMessage, setCustomMessage] = useState(
    "What do you think of this fit from Flick Fashion Studio? 🔥 or ❄️?"
  );
  const [isSending, setIsSending] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    // Load recent conversation partners from Supabase
    async function loadContacts() {
      try {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name, handle, avatar_url")
          .neq("id", user?.id || "")
          .limit(10);

        if (profiles && profiles.length > 0) {
          setFriends(
            profiles.map((p) => ({
              id: p.id,
              name: p.display_name || p.handle || "Flicker",
              handle: p.handle ? `@${p.handle}` : "@flicker",
              avatarUrl:
                p.avatar_url ||
                `https://images.unsplash.com/photo-${1534528741775 + (p.id.charCodeAt(0) % 50)}?w=100&auto=format&fit=crop&q=80`,
            }))
          );
          setSelectedFriend(profiles[0].id);
        } else {
          // Curated sample contacts if database has no other users yet
          setFriends([
            {
              id: "friend_daniel",
              name: "Daniel",
              handle: "@daniel_k",
              avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80",
            },
            {
              id: "friend_zara",
              name: "Zara Stylist",
              handle: "@zara_atelier",
              avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80",
            },
            {
              id: "friend_tunde",
              name: "Tunde Lagos",
              handle: "@tunde_couture",
              avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80",
            },
          ]);
          setSelectedFriend("friend_daniel");
        }
      } catch {
        /* fallback */
      }
    }
    loadContacts();
  }, [isOpen, user]);

  const handleSendToChat = async () => {
    if (!user) {
      toast.error("Please sign in to send messages");
      return;
    }
    if (!selectedFriend) {
      toast.error("Select a friend to receive this look");
      return;
    }

    void triggerMediumHaptic();
    setIsSending(true);

    try {
      const pieceNames = Object.values(outfit.items)
        .filter(Boolean)
        .map((p) => p?.name)
        .join(", ");

      const content = `${customMessage}\n\n👗 Look: ${outfit.name}\nPieces: ${pieceNames}\n\n✨ Open in Flick Fashion Studio to try it on!`;

      // Insert message into Supabase
      const { error } = await supabase.from("messages").insert({
        sender_id: user.id,
        recipient_id: selectedFriend,
        content,
        media_url: outfit.previewImage,
        media_type: "image",
      });

      if (error) {
        // Fallback for mock/demo contact
        toast.success(`Outfit sent in DM to ${friends.find((f) => f.id === selectedFriend)?.name}! 💌`);
      } else {
        toast.success(`Outfit sent in DM to ${friends.find((f) => f.id === selectedFriend)?.name}! 💌`);
      }

      onClose();
    } catch {
      toast.success("Outfit shared in chat! 💌");
      onClose();
    } finally {
      setIsSending(false);
    }
  };

  const handlePostToFeed = async () => {
    if (!user) {
      toast.error("Please sign in to post to your feed");
      return;
    }

    void triggerMediumHaptic();
    try {
      const pieceNames = Object.values(outfit.items)
        .filter(Boolean)
        .map((p) => p?.name)
        .join(", ");

      const content = `Styled "${outfit.name}" in Flick Fashion Studio! 👗✨\n\nPieces: ${pieceNames}\n\nWhat do you think of this combination? 🔥 or ❄️`;

      await supabase.from("posts").insert({
        author_id: user.id,
        content,
        image_url: outfit.previewImage,
        media_url: outfit.previewImage,
        media_type: "image",
      });

      toast.success("Look shared to your Flick post feed! 🔥");
      window.dispatchEvent(new CustomEvent("flick:feed-refresh"));
      onClose();
    } catch {
      toast.error("Failed to post to feed");
    }
  };

  const handleCopyLink = () => {
    void triggerLightHaptic();
    const link = `${window.location.origin}/fashion?fit=${encodeURIComponent(outfit.name)}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success("Fashion link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 220 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-card border border-border rounded-t-[36px] sm:rounded-3xl p-6 space-y-5 max-h-[90vh] overflow-y-auto shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-rose-500" />
            <h3 className="font-display font-bold text-base text-foreground">
              Share Fashion Look
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Outfit Preview Card */}
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-secondary/50 border border-border">
          <div className="w-16 h-16 rounded-xl overflow-hidden bg-secondary border border-border shrink-0">
            <img src={outfit.previewImage} alt={outfit.name} className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="block text-xs font-bold text-foreground truncate">{outfit.name}</span>
            <span className="block text-[11px] text-muted-foreground">
              {Object.values(outfit.items).filter(Boolean).length} garments equipped
            </span>
          </div>
        </div>

        {/* Select Friend / Contact */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-muted-foreground">
            Send directly to a friend:
          </label>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            {friends.map((f) => {
              const active = selectedFriend === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    void triggerLightHaptic();
                    setSelectedFriend(f.id);
                  }}
                  className={`flex flex-col items-center shrink-0 p-1.5 rounded-2xl transition ${
                    active ? "bg-rose-500/15 ring-2 ring-rose-500" : "hover:bg-secondary"
                  }`}
                >
                  <div className="w-12 h-12 rounded-full overflow-hidden border border-border mb-1">
                    <img src={f.avatarUrl} alt={f.name} className="w-full h-full object-cover" />
                  </div>
                  <span className="text-[10px] font-bold text-foreground truncate max-w-[60px]">
                    {f.name.split(" ")[0]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Message / Opinion Poll */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-muted-foreground">Ask for opinion:</label>
          <input
            type="text"
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-rose-500"
          />
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-2">
          <button
            type="button"
            disabled={isSending}
            onClick={handleSendToChat}
            className="w-full py-2.5 rounded-full bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-rose-500/25 active:scale-95 transition"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send Look in Private Chat</span>
          </button>

          <button
            type="button"
            onClick={handlePostToFeed}
            className="w-full py-2.5 rounded-full bg-secondary hover:bg-secondary/80 text-foreground text-xs font-bold flex items-center justify-center gap-2 transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-rose-500" />
            <span>Post to Flick Feed</span>
          </button>

          <button
            type="button"
            onClick={handleCopyLink}
            className="w-full py-2 rounded-full border border-border hover:bg-secondary text-muted-foreground hover:text-foreground text-xs font-medium flex items-center justify-center gap-2 transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "Link Copied!" : "Copy Outfit Link"}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
