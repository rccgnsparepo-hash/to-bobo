import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Link2, MessageCircle, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar } from "./Avatar";
import { toast } from "sonner";

type Profile = { id: string; handle: string; display_name: string; avatar_url: string | null };

export function ShareSheet({
  open,
  onClose,
  postId,
  postPreview,
}: {
  open: boolean;
  onClose: () => void;
  postId: string;
  postPreview: string;
}) {
  const { user } = useAuth();
  const [people, setPeople] = useState<Profile[]>([]);
  const [q, setQ] = useState("");
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    supabase.from("profiles").select("*").neq("id", user.id).limit(60)
      .then(({ data }) => setPeople((data ?? []) as Profile[]));
  }, [open, user]);

  const filtered = useMemo(
    () => people.filter((p) => !q || p.handle.toLowerCase().includes(q.toLowerCase()) || p.display_name.toLowerCase().includes(q.toLowerCase())),
    [people, q],
  );

  const link = `${window.location.origin}/?p=${postId}`;

  const sendTo = async (peer: Profile) => {
    if (!user) return;
    setSent((s) => ({ ...s, [peer.id]: true }));
    await supabase.from("messages").insert({
      sender_id: user.id,
      recipient_id: peer.id,
      content: `Flick: ${postPreview.slice(0, 80)}\n${link}`,
    });
    toast.success(`Sent to @${peer.handle}`);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center"
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }}
            transition={{ type: "spring", damping: 28 }}
            className="w-full md:max-w-md bg-card border-t md:border border-border rounded-t-3xl md:rounded-3xl flex flex-col max-h-[80vh]"
          >
            <div className="flex items-center justify-center pt-3">
              <div className="w-10 h-1 bg-border rounded-full" />
            </div>
            <div className="px-4 pt-3 pb-2 flex items-center justify-between">
              <h3 className="font-semibold">Share</h3>
              <button onClick={onClose}><X className="w-5 h-5" /></button>
            </div>

            <div className="px-4 pb-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search"
                  className="w-full bg-input rounded-full pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <div className="overflow-y-auto px-4 pb-3 grid grid-cols-3 gap-x-2 gap-y-4">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => sendTo(p)}
                  className="flex flex-col items-center gap-1 group"
                >
                  <div className="relative">
                    <Avatar url={p.avatar_url} name={p.display_name} size={64} />
                    {sent[p.id] && (
                      <span className="absolute inset-0 grid place-items-center bg-emerald-500/80 rounded-full text-white">
                        <Check className="w-6 h-6" />
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] truncate max-w-[72px]">{p.display_name}</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="col-span-3 text-center text-muted-foreground text-sm py-6">No one found.</p>
              )}
            </div>

            <div className="border-t border-border px-2 py-3 flex items-center gap-2 overflow-x-auto no-scrollbar">
              <ShareAction onClick={copy} label={copied ? "Copied" : "Copy link"} icon={copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />} tint="bg-secondary" />
              <ShareAction onClick={copy} label="Link" icon={<Link2 className="w-5 h-5" />} tint="bg-secondary" />
              <ShareAction
                onClick={() => { window.open(`https://wa.me/?text=${encodeURIComponent(link)}`, "_blank"); }}
                label="WhatsApp" icon={<MessageCircle className="w-5 h-5" />} tint="bg-emerald-500 text-white" />
              <ShareAction
                onClick={() => { window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(postPreview)}&url=${encodeURIComponent(link)}`, "_blank"); }}
                label="X" icon={<span className="font-bold">𝕏</span>} tint="bg-foreground text-background" />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ShareAction({ icon, label, onClick, tint }: { icon: React.ReactNode; label: string; onClick: () => void; tint: string }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1 shrink-0 px-2">
      <span className={`w-12 h-12 rounded-full grid place-items-center ${tint}`}>{icon}</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </button>
  );
}