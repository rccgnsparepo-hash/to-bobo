import { motion, AnimatePresence } from "framer-motion";
import {
  Bookmark,
  Share2,
  QrCode,
  EyeOff,
  Flag,
  Star,
  X,
  Download,
  Copy,
  BookmarkCheck,
  Trash2,
  UserX,
  VolumeX,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { downloadMedia } from "@/lib/downloadMedia";
import { isPostBookmarked, toggleBookmark } from "@/lib/bookmarks/bookmarkService";
import { blockUser, muteUser } from "@/lib/safety/safetyService";
import { ReportModal } from "@/components/safety/ReportModal";

export function PostActions({
  postId,
  mediaUrl,
  mediaType,
  open,
  onClose,
  onShare,
  isAuthor,
  onDelete,
  authorId,
  authorHandle,
  postContent,
}: {
  postId: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  open: boolean;
  onClose: () => void;
  onShare: () => void;
  isAuthor?: boolean;
  onDelete?: () => void;
  authorId?: string;
  authorHandle?: string;
  postContent?: string;
}) {
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);

  useEffect(() => {
    if (!user || !open) return;
    isPostBookmarked(user.id, postId).then(setSaved);
  }, [user, postId, open]);

  const handleToggleSave = async () => {
    if (!user) {
      toast.error("Please sign in to save bookmarks");
      return;
    }
    const res = await toggleBookmark(user.id, postId);
    setSaved(res.saved);
    toast.success(res.saved ? "Saved to your private bookmarks" : "Removed from bookmarks");
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(`${location.origin}/?post=${postId}`);
    toast.success("Link copied");
  };

  const handleBlock = async () => {
    if (!user || !authorId) return;
    await blockUser(user.id, authorId);
    toast.success(`Blocked @${authorHandle || "user"}`);
    onClose();
  };

  const handleMute = async () => {
    if (!user || !authorId) return;
    await muteUser(user.id, authorId);
    toast.success(`Muted @${authorHandle || "user"}`);
    onClose();
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Post actions"
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4"
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full md:max-w-sm card-glass rounded-t-[32px] md:rounded-3xl p-5 pb-8 space-y-4"
            >
              <div className="flex items-center justify-between pb-1">
                <span className="font-bold text-sm text-muted-foreground uppercase tracking-wider">
                  Flick Options
                </span>
                <button
                  onClick={onClose}
                  aria-label="Close options"
                  className="p-1 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Quick 3 action tiles */}
              <div className="grid grid-cols-3 gap-2.5">
                <Quick
                  onClick={handleToggleSave}
                  icon={saved ? BookmarkCheck : Bookmark}
                  label={saved ? "Saved" : "Save"}
                  active={saved}
                />
                <Quick
                  onClick={() => {
                    onShare();
                    onClose();
                  }}
                  icon={Share2}
                  label="Share"
                />
                <Quick onClick={copyLink} icon={Copy} label="Copy link" />
              </div>

              <ul className="divide-y divide-border/60 text-sm">
                {mediaUrl && (
                  <li>
                    <button
                      onClick={() => {
                        onClose();
                        void downloadMedia(mediaUrl, `flick-${postId.slice(0, 8)}`, mediaType || undefined);
                      }}
                      className="flex items-center gap-3 py-3 w-full text-left hover:text-snap transition"
                    >
                      <Download className="w-4 h-4 text-muted-foreground" />
                      <span>Download media</span>
                    </button>
                  </li>
                )}

                <li>
                  <button
                    className="flex items-center gap-3 py-3 w-full text-left hover:text-snap transition"
                    onClick={() => {
                      copyLink();
                      toast.success("Flick link copied for QR sharing");
                      onClose();
                    }}
                  >
                    <QrCode className="w-4 h-4 text-muted-foreground" />
                    <span>QR code share link</span>
                  </button>
                </li>

                {!isAuthor && authorId && (
                  <>
                    <li>
                      <button
                        className="flex items-center gap-3 py-3 w-full text-left hover:text-foreground transition"
                        onClick={handleMute}
                      >
                        <VolumeX className="w-4 h-4 text-muted-foreground" />
                        <span>Mute @{authorHandle || "user"}</span>
                      </button>
                    </li>
                    <li>
                      <button
                        className="flex items-center gap-3 py-3 w-full text-left hover:text-foreground transition"
                        onClick={handleBlock}
                      >
                        <UserX className="w-4 h-4 text-muted-foreground" />
                        <span>Block @{authorHandle || "user"}</span>
                      </button>
                    </li>
                    <li>
                      <button
                        className="flex items-center gap-3 py-3 w-full text-left text-destructive font-semibold hover:bg-destructive/10 px-1 rounded-xl transition"
                        onClick={() => {
                          onClose();
                          setReportModalOpen(true);
                        }}
                      >
                        <Flag className="w-4 h-4" />
                        <span>Report flick</span>
                      </button>
                    </li>
                  </>
                )}

                {isAuthor && onDelete && (
                  <li>
                    <button
                      className="flex items-center gap-3 py-3 w-full text-left text-destructive font-semibold hover:bg-destructive/10 px-1 rounded-xl transition"
                      onClick={() => {
                        onClose();
                        onDelete();
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete flick</span>
                    </button>
                  </li>
                )}
              </ul>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Report Modal */}
      <ReportModal
        open={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        targetType="post"
        targetId={postId}
        targetSnippet={postContent}
      />
    </>
  );
}

function Quick({
  icon: Icon,
  label,
  onClick,
  active,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 rounded-2xl py-3 border transition ${
        active
          ? "bg-snap/20 border-snap/50 text-snap font-bold"
          : "bg-secondary/60 hover:bg-secondary border-border/80 text-foreground"
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="text-[11px] font-semibold">{label}</span>
    </button>
  );
}