import {
  Heart,
  MessageCircle,
  Repeat2,
  Send,
  X,
  Share2,
  Download,
  MoreHorizontal,
  Volume2,
  VolumeX,
  Play,
  Trash2,
  Loader2,
  CornerDownRight,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatDistanceToNowStrict } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar } from "./Avatar";
import { Reactions } from "./Reactions";
import { ShareSheet } from "./ShareSheet";
import { VoiceMessage } from "./VoiceMessage";
import { PostActions } from "./PostActions";
import { Link } from "react-router-dom";
import { notify } from "@/lib/notify";
import { triggerNotchNotification } from "@/components/notifications/NotchNotification";
import { toast } from "sonner";
import { downloadMedia } from "@/lib/downloadMedia";
import { playSound } from "@/lib/soundEngine";
import { FlickVerifiedBadge } from "@/components/FlickVerifiedBadge";
import { isUserVerified } from "@/lib/verification";

export type PostRow = {
  id: string;
  content: string;
  image_url: string | null;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
  author: { id: string; handle: string; display_name: string; avatar_url: string | null } | null;
};

type Comment = {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  author: { handle: string; display_name: string; avatar_url: string | null } | null;
};

export function PostCard({ post }: { post: PostRow }) {
  const { user, profile } = useAuth();
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [reshareCount, setReshareCount] = useState(0);
  const [reshared, setReshared] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  const isAuthor = !!user && user.id === post.author?.id;

  const handleDeletePost = async () => {
    if (!user || user.id !== post.author?.id) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("posts").delete().eq("id", post.id).eq("author_id", user.id);
      if (error) throw error;
      setDeleted(true);
      setConfirmDeleteOpen(false);
      triggerNotchNotification({
        kind: "system",
        title: "Flick Deleted",
        message: "Your flick was permanently removed.",
      });
      toast.success("Flick deleted successfully");
      window.dispatchEvent(new CustomEvent("flick:post-deleted", { detail: { id: post.id } }));
    } catch (err: any) {
      toast.error(err.message || "Failed to delete post.");
    } finally {
      setDeleting(false);
    }
  };

  const toggleVideo = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  const refreshCounts = async () => {
    const [likes, reshares, comments] = await Promise.all([
      supabase.from("likes").select("user_id", { count: "exact" }).eq("post_id", post.id),
      supabase.from("reshares").select("user_id", { count: "exact" }).eq("post_id", post.id),
      supabase.from("comments").select("id", { count: "exact", head: true }).eq("post_id", post.id),
    ]);
    setLikeCount(likes.count ?? 0);
    setReshareCount(reshares.count ?? 0);
    setCommentCount(comments.count ?? 0);
    setLiked(!!likes.data?.some((d) => d.user_id === user?.id));
    setReshared(!!reshares.data?.some((d) => d.user_id === user?.id));
  };

  useEffect(() => {
    refreshCounts();
    const ch = supabase
      .channel(`post-${post.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "likes", filter: `post_id=eq.${post.id}` },
        refreshCounts,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reshares", filter: `post_id=eq.${post.id}` },
        refreshCounts,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comments", filter: `post_id=eq.${post.id}` },
        refreshCounts,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id, user?.id]);

  const toggleLike = async () => {
    if (!user) return;
    if (liked) {
      setLiked(false);
      setLikeCount((c) => Math.max(0, c - 1));
      await supabase.from("likes").delete().eq("user_id", user.id).eq("post_id", post.id);
    } else {
      setLiked(true);
      setLikeCount((c) => c + 1);
      try {
        playSound("flick_reaction");
      } catch {}
      await supabase.from("likes").insert({ user_id: user.id, post_id: post.id });
      if (post.author?.id && post.author.id !== user.id) {
        const actorName = profile?.display_name || user.user_metadata?.display_name || user.user_metadata?.full_name || "Someone";
        const actorHandle = profile?.handle || user.user_metadata?.handle || "user";
        const actorAvatar = profile?.avatar_url || user.user_metadata?.avatar_url || null;

        notify({
          kind: "like",
          title: `${actorName} liked your flick`,
          message: post.content?.slice(0, 80) ?? "Your flick received a like reaction",
          actor: {
            id: user.id,
            display_name: actorName,
            handle: actorHandle,
            avatar_url: actorAvatar,
          },
          data: { post_id: post.id },
          recipients: [post.author.id],
          url: `/u/${post.author.handle}`,
        });
      }
    }
  };

  const toggleReshare = async () => {
    if (!user) return;
    if (reshared) {
      setReshared(false);
      setReshareCount((c) => Math.max(0, c - 1));
      await supabase.from("reshares").delete().eq("user_id", user.id).eq("post_id", post.id);
    } else {
      setReshared(true);
      setReshareCount((c) => c + 1);
      try {
        playSound("message_sent");
      } catch {}
      await supabase.from("reshares").insert({ user_id: user.id, post_id: post.id });
    }
  };

  const fetchCommentsForPost = async (): Promise<Comment[]> => {
    try {
      const { data: rawComments, error } = await supabase
        .from("comments")
        .select("id, post_id, author_id, content, created_at")
        .eq("post_id", post.id)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error loading comments:", error);
        return [];
      }
      if (!rawComments || rawComments.length === 0) {
        return [];
      }

      const authorIds = Array.from(new Set(rawComments.map((c) => c.author_id).filter(Boolean)));
      const profileMap: Record<string, { handle: string; display_name: string; avatar_url: string | null }> = {};

      if (authorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, handle, display_name, avatar_url")
          .in("id", authorIds);

        (profiles || []).forEach((p) => {
          profileMap[p.id] = {
            handle: p.handle || "user",
            display_name: p.display_name || "User",
            avatar_url: p.avatar_url || null,
          };
        });
      }

      return rawComments.map((c) => ({
        id: c.id,
        content: c.content,
        created_at: c.created_at,
        author_id: c.author_id,
        author: profileMap[c.author_id] || {
          handle: "user",
          display_name: "User",
          avatar_url: null,
        },
      }));
    } catch (e) {
      console.error("Failed to load comments:", e);
      return [];
    }
  };

  const openComments = async () => {
    setShowComments(true);
    setLoadingComments(true);
    const loaded = await fetchCommentsForPost();
    setComments(loaded);
    setLoadingComments(false);
  };

  const sendComment = async () => {
    if (!user || !draft.trim()) return;
    const c = draft.trim();
    setDraft("");

    try {
      playSound("message_sent");
    } catch {}

    const { error } = await supabase
      .from("comments")
      .insert({ post_id: post.id, author_id: user.id, content: c });

    if (error) {
      toast.error("Failed to post comment");
      return;
    }

    setCommentCount((prev) => prev + 1);

    if (post.author?.id && post.author.id !== user.id) {
      const actorName =
        profile?.display_name ||
        user.user_metadata?.display_name ||
        user.user_metadata?.full_name ||
        "Someone";
      const actorHandle = profile?.handle || user.user_metadata?.handle || "user";
      const actorAvatar = profile?.avatar_url || user.user_metadata?.avatar_url || null;

      notify({
        kind: "comment",
        title: `${actorName} commented on your flick`,
        message: c.slice(0, 100),
        actor: {
          id: user.id,
          display_name: actorName,
          handle: actorHandle,
          avatar_url: actorAvatar,
        },
        data: { post_id: post.id },
        recipients: [post.author.id],
        url: `/u/${post.author.handle}`,
      });
    }

    const reloaded = await fetchCommentsForPost();
    setComments(reloaded);
  };

  const deleteComment = async (commentId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("comments")
        .delete()
        .eq("id", commentId)
        .eq("author_id", user.id);

      if (error) throw error;
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setCommentCount((prev) => Math.max(0, prev - 1));
      toast.success("Comment deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete comment");
    }
  };

  const mediaSrc = post.media_url ?? post.image_url;
  const dlName = mediaSrc ? mediaSrc.split("/").pop() || "flick-media" : "flick-media";

  if (deleted) return null;

  return (
    <>
      <motion.article
        layout
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 26 }}
        whileHover={{ y: -2 }}
        className="px-4 py-3 border-b border-border hover:bg-secondary/20 transition flex gap-3"
      >
        <Link
          to={post.author?.handle ? `/u/${post.author.handle}` : "#"}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0"
        >
          <Avatar url={post.author?.avatar_url} name={post.author?.display_name} size={44} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-sm">
            <Link
              to={post.author?.handle ? `/u/${post.author.handle}` : "#"}
              className="font-bold truncate hover:underline flex items-center gap-1.5"
            >
              <span>{post.author?.display_name ?? "Unknown"}</span>
              {isUserVerified(post.author?.id) && <FlickVerifiedBadge size={14} />}
            </Link>
            <span className="text-muted-foreground truncate">@{post.author?.handle}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">
              {formatDistanceToNowStrict(new Date(post.created_at))}
            </span>
            {isAuthor && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDeleteOpen(true);
                }}
                className="ml-auto p-1 text-muted-foreground hover:text-destructive transition"
                title="Delete this flick"
                aria-label="Delete this flick"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setActionsOpen(true)}
              className={`${isAuthor ? "ml-1" : "ml-auto"} p-1 text-muted-foreground hover:text-foreground`}
              aria-label="More"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
          {post.content && (
            <p className="mt-1 whitespace-pre-wrap break-anywhere">{post.content}</p>
          )}
          {mediaSrc && (
            <div className="mt-3 relative group">
              {post.media_type === "video" && (
                <div
                  className="relative"
                  onClick={(e) => {
                    e.preventDefault();
                    toggleVideo();
                  }}
                >
                  <video
                    ref={videoRef}
                    src={mediaSrc}
                    autoPlay
                    muted={muted}
                    loop
                    playsInline
                    className="rounded-2xl border border-border max-h-[520px] w-full bg-black no-controls"
                    onPlay={() => setPlaying(true)}
                    onPause={() => setPlaying(false)}
                  />
                  {!playing && (
                    <div className="absolute inset-0 grid place-items-center pointer-events-none">
                      <div className="bg-black/50 rounded-full p-4 backdrop-blur">
                        <Play className="w-8 h-8 text-white" />
                      </div>
                    </div>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMuted((m) => !m);
                    }}
                    className="absolute bottom-2 right-2 bg-background/80 backdrop-blur rounded-full p-2 border border-border"
                    aria-label={muted ? "Unmute" : "Mute"}
                  >
                    {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                </div>
              )}
              {post.media_type === "audio" && (
                <div className="rounded-2xl border border-border bg-card p-3">
                  <VoiceMessage
                    src={mediaSrc}
                    senderName={post.author?.display_name || (post.author?.handle ? `@${post.author.handle}` : "Voice Post")}
                    senderAvatar={post.author?.avatar_url}
                  />
                </div>
              )}
              {(post.media_type === "image" || (!post.media_type && post.image_url)) && (
                <img
                  src={mediaSrc}
                  alt=""
                  className="rounded-2xl border border-border max-h-[520px] w-full object-cover"
                  loading="lazy"
                />
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  void downloadMedia(mediaSrc, dlName);
                }}
                className="absolute top-2 right-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 transition bg-background/80 backdrop-blur rounded-full p-2 border border-border"
                aria-label="Download"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-6 mt-3 text-muted-foreground text-sm flex-wrap">
            <button
              onClick={() => {
                if (showComments) setShowComments(false);
                else openComments();
              }}
              className="flex items-center gap-1.5 hover:text-primary transition"
            >
              <MessageCircle className="w-4 h-4" /> {commentCount > 0 && commentCount}
            </button>
            <button
              onClick={toggleReshare}
              className={`flex items-center gap-1.5 transition ${reshared ? "text-emerald-400" : "hover:text-emerald-400"}`}
            >
              <Repeat2 className="w-4 h-4" /> {reshareCount > 0 && reshareCount}
            </button>
            <button
              onClick={toggleLike}
              className={`flex items-center gap-1.5 transition ${liked ? "text-rose-500" : "hover:text-rose-500"}`}
            >
              <Heart className={`w-4 h-4 ${liked ? "fill-current" : ""}`} />{" "}
              {likeCount > 0 && likeCount}
            </button>
            <Reactions postId={post.id} authorId={post.author?.id} postContent={post.content} />
            <button
              onClick={() => setShareOpen(true)}
              className="flex items-center gap-1.5 hover:text-snap transition ml-auto"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        <ShareSheet
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          postId={post.id}
          postPreview={post.content || "Check this flick"}
        />
        <PostActions
          postId={post.id}
          mediaUrl={mediaSrc}
          mediaType={post.media_type}
          open={actionsOpen}
          onClose={() => setActionsOpen(false)}
          onShare={() => setShareOpen(true)}
          isAuthor={isAuthor}
          onDelete={() => setConfirmDeleteOpen(true)}
        />
      </motion.article>

      {/* Delete Reconfirmation Modal */}
      <AnimatePresence>
        {confirmDeleteOpen && (
          <div
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={(e) => {
              e.stopPropagation();
              setConfirmDeleteOpen(false);
            }}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-card border border-border rounded-3xl p-6 shadow-2xl space-y-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-destructive/15 text-destructive grid place-items-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="font-display text-lg font-bold">Delete this flick?</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  This flick and all of its comments and reactions will be permanently deleted. This action cannot be undone.
                </p>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setConfirmDeleteOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-secondary text-foreground text-xs font-semibold hover:bg-secondary/70 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleDeletePost}
                  className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-xs font-bold hover:brightness-110 transition disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showComments && (
          <CommentSheet
            postId={post.id}
            postAuthor={post.author}
            postSnippet={post.content}
            comments={comments}
            loading={loadingComments}
            draft={draft}
            setDraft={setDraft}
            onSend={sendComment}
            onDeleteComment={deleteComment}
            onReload={async () => {
              const loaded = await fetchCommentsForPost();
              setComments(loaded);
            }}
            onClose={() => setShowComments(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function CommentSheet({
  postId,
  postAuthor,
  postSnippet,
  comments,
  loading,
  draft,
  setDraft,
  onSend,
  onDeleteComment,
  onReload,
  onClose,
}: {
  postId: string;
  postAuthor?: { id: string; handle: string; display_name: string; avatar_url: string | null } | null;
  postSnippet?: string;
  comments: Comment[];
  loading: boolean;
  draft: string;
  setDraft: React.Dispatch<React.SetStateAction<string>> | ((s: string) => void);
  onSend: () => void;
  onDeleteComment: (commentId: string) => void;
  onReload: () => void;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Subscribe to real-time comments on this specific post
  useEffect(() => {
    const ch = supabase
      .channel(`comments-rt-${postId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comments", filter: `post_id=eq.${postId}` },
        () => {
          onReload();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  // Scroll to bottom when comments list updates
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [comments.length]);

  const QUICK_EMOJIS = ["😂", "🤣", "🔥", "❤️", "😍", "👏", "💀", "🙌", "💯"] as const;

  const handleAddEmoji = (emoji: string) => {
    setDraft((prev: string) => (prev ? `${prev} ${emoji}` : emoji));
    inputRef.current?.focus();
  };

  const handleReplyTo = (handle: string) => {
    setDraft((prev: string) => (prev ? `${prev} @${handle} ` : `@${handle} `));
    inputRef.current?.focus();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6"
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full md:max-w-lg bg-card rounded-t-3xl md:rounded-3xl border border-border max-h-[85vh] h-[600px] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-card/60 backdrop-blur">
          <div>
            <h3 className="font-display font-bold text-base flex items-center gap-2">
              <span>Comments</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-semibold">
                {comments.length}
              </span>
            </h3>
            {postAuthor && (
              <p className="text-xs text-muted-foreground truncate max-w-xs mt-0.5">
                Flick by <span className="font-semibold text-foreground">@{postAuthor.handle}</span>
                {postSnippet ? ` · "${postSnippet.slice(0, 35)}${postSnippet.length > 35 ? "…" : ""}"` : ""}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition"
            aria-label="Close comments"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Comments Feed */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {loading && comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin text-snap" />
              <span className="text-xs font-medium">Loading comments…</span>
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-secondary/80 grid place-items-center text-2xl">
                💬
              </div>
              <p className="font-semibold text-foreground text-sm">No comments yet</p>
              <p className="text-xs max-w-xs leading-relaxed">
                Be the first to join the conversation, laugh, or react to this flick!
              </p>
            </div>
          ) : (
            comments.map((c) => {
              const isCommentAuthor = !!user && c.author_id === user.id;
              return (
                <div key={c.id} className="flex items-start gap-3 text-sm group">
                  <Link
                    to={c.author?.handle ? `/u/${c.author.handle}` : "#"}
                    onClick={onClose}
                    className="shrink-0 mt-0.5"
                  >
                    <Avatar url={c.author?.avatar_url} name={c.author?.display_name} size={36} />
                  </Link>

                  <div className="flex-1 min-w-0 bg-secondary/30 hover:bg-secondary/40 transition rounded-2xl p-3 border border-border/40">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <Link
                        to={c.author?.handle ? `/u/${c.author.handle}` : "#"}
                        onClick={onClose}
                        className="font-bold text-xs truncate hover:underline flex items-center gap-1"
                      >
                        <span>{c.author?.display_name ?? "User"}</span>
                        {isUserVerified(c.author_id) && <FlickVerifiedBadge size={12} />}
                      </Link>
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {formatDistanceToNowStrict(new Date(c.created_at))}
                      </span>
                    </div>

                    <p className="text-xs text-foreground/95 whitespace-pre-wrap break-words leading-relaxed">
                      {c.content}
                    </p>

                    {/* Comment action footer */}
                    <div className="flex items-center gap-3 mt-2 pt-1 border-t border-border/30 text-[11px] text-muted-foreground">
                      <button
                        type="button"
                        onClick={() => handleReplyTo(c.author?.handle || "user")}
                        className="flex items-center gap-1 hover:text-snap font-medium transition"
                      >
                        <CornerDownRight className="w-3 h-3" />
                        <span>Reply</span>
                      </button>

                      {isCommentAuthor && (
                        <button
                          type="button"
                          onClick={() => onDeleteComment(c.id)}
                          className="flex items-center gap-1 text-muted-foreground/60 hover:text-destructive transition ml-auto"
                          title="Delete your comment"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Quick Reactions & Laugh Emojis Bar */}
        <div className="px-4 py-2 bg-card/90 border-t border-border/60 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider shrink-0 mr-1">
            React:
          </span>
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleAddEmoji(emoji)}
              className="text-lg p-1 hover:scale-125 active:scale-95 transition-transform shrink-0"
              title={`Add ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Comment Composer Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSend();
          }}
          className="p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-border bg-card flex items-center gap-2"
        >
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a comment or laugh… 😂"
            className="flex-1 bg-secondary/60 hover:bg-secondary/90 focus:bg-background border border-border rounded-full px-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-snap/50 transition placeholder:text-muted-foreground/70"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="w-10 h-10 rounded-full bg-snap text-snap-foreground grid place-items-center hover:brightness-110 active:scale-95 transition disabled:opacity-40 disabled:pointer-events-none shrink-0 shadow-sm"
            title="Post comment"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}
