import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Heart,
  MessageCircle,
  Repeat2,
  Share2,
  Bookmark,
  Trash2,
  MoreHorizontal,
  Send,
  Eye,
  Smile,
  Volume2,
  VolumeX,
  Play,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { Reactions } from "@/components/Reactions";
import { ShareSheet } from "@/components/ShareSheet";
import { PostActions } from "@/components/PostActions";
import { FlickVerifiedBadge } from "@/components/FlickVerifiedBadge";
import { isUserVerified } from "@/lib/verification";
import { TopFlickerBadge } from "@/components/TopFlickerBadge";
import { getUserTopRank } from "@/lib/topFlickers";
import { detectSocialUrl, resolveSocialEmbed, type SocialEmbed } from "@/lib/socialEmbeds";
import { SocialEmbedCard } from "@/components/social/SocialEmbedCard";
import { getFlickViews, recordFlickView, formatFlickViews } from "@/lib/flickViews";
import { AutocorrectBar } from "@/components/common/AutocorrectBar";
import { applyInlineAutocorrect } from "@/lib/autocorrect";
import { FullEmojiPicker } from "@/components/common/FullEmojiPicker";
import { format, formatDistanceToNowStrict } from "date-fns";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { playSound } from "@/lib/soundEngine";
import { notify } from "@/lib/notify";

export type PostDetailData = {
  id: string;
  content: string;
  image_url: string | null;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
  author_id?: string;
  author: { id: string; handle: string; display_name: string; avatar_url: string | null } | null;
};

type CommentRow = {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  author: { handle: string; display_name: string; avatar_url: string | null } | null;
};

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [post, setPost] = useState<PostDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [reshared, setReshared] = useState(false);
  const [reshareCount, setReshareCount] = useState(0);
  const [bookmarked, setBookmarked] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [socialEmbed, setSocialEmbed] = useState<SocialEmbed | null>(null);
  const [views, setViews] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  // Load post details & record genuine view
  useEffect(() => {
    if (!id) return;

    let isMounted = true;
    setLoading(true);

    const loadPost = async () => {
      try {
        const { data, error } = await supabase
          .from("posts")
          .select("*, author:profiles!posts_author_id_fkey(id, handle, display_name, avatar_url)")
          .eq("id", id)
          .single();

        if (error || !data) {
          toast.error("Post not found");
          setLoading(false);
          return;
        }

        if (isMounted) {
          const postData = data as unknown as PostDetailData;
          setPost(postData);

          // Record genuine view strictly
          const genuineViews = recordFlickView(postData.id, postData.created_at);
          setViews(genuineViews);

          // Check embed
          if (postData.content) {
            const detected = detectSocialUrl(postData.content);
            if (detected) {
              resolveSocialEmbed(detected.url).then((res) => {
                if (res && isMounted) setSocialEmbed(res);
              });
            }
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void loadPost();

    // Load comments
    const loadComments = async () => {
      const { data } = await supabase
        .from("comments")
        .select("*, author:profiles!comments_author_id_fkey(handle, display_name, avatar_url)")
        .eq("post_id", id)
        .order("created_at", { ascending: true });
      if (isMounted && data) {
        setComments(data as unknown as CommentRow[]);
      }
    };
    void loadComments();

    // Check likes count & user liked status
    const loadLikes = async () => {
      const { count } = await supabase
        .from("likes")
        .select("id", { count: "exact", head: true })
        .eq("post_id", id);
      if (isMounted) setLikeCount(count ?? 0);

      if (user) {
        const { data: myLike } = await supabase
          .from("likes")
          .select("id")
          .eq("post_id", id)
          .eq("user_id", user.id)
          .maybeSingle();
        if (isMounted) setLiked(!!myLike);

        const { data: myReshare } = await supabase
          .from("reshares")
          .select("id")
          .eq("post_id", id)
          .eq("user_id", user.id)
          .maybeSingle();
        if (isMounted) setReshared(!!myReshare);
      }

      const { count: resharesTotal } = await supabase
        .from("reshares")
        .select("id", { count: "exact", head: true })
        .eq("post_id", id);
      if (isMounted) setReshareCount(resharesTotal ?? 0);
    };
    void loadLikes();

    // Listen for realtime view updates
    const onViewsUpdate = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d?.postId === id && isMounted) {
        setViews(d.views);
      }
    };
    window.addEventListener("flick:view-count-updated", onViewsUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener("flick:view-count-updated", onViewsUpdate);
    };
  }, [id, user]);

  const toggleLike = async () => {
    if (!user || !post) {
      toast.error("Please sign in to like");
      return;
    }
    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikeCount((c) => (nextLiked ? c + 1 : Math.max(0, c - 1)));
    playSound(nextLiked ? "like" : "pop");

    if (nextLiked) {
      await supabase.from("likes").insert({ post_id: post.id, user_id: user.id });
      if (post.author?.id && post.author.id !== user.id) {
        notify({
          kind: "like",
          title: "New Like",
          message: `${profile?.display_name || "Someone"} liked your flick`,
          actor: { id: user.id, display_name: profile?.display_name || "User", handle: profile?.handle || "user" },
          recipients: [post.author.id],
          url: `/post/${post.id}`,
        });
      }
    } else {
      await supabase.from("likes").delete().eq("post_id", post.id).eq("user_id", user.id);
    }
  };

  const toggleReshare = async () => {
    if (!user || !post) {
      toast.error("Please sign in to reshare");
      return;
    }
    const next = !reshared;
    setReshared(next);
    setReshareCount((c) => (next ? c + 1 : Math.max(0, c - 1)));
    playSound("pop");

    if (next) {
      await supabase.from("reshares").insert({ post_id: post.id, user_id: user.id });
      toast.success("Reposted to your profile!");
    } else {
      await supabase.from("reshares").delete().eq("post_id", post.id).eq("user_id", user.id);
      toast.info("Repost removed");
    }
  };

  const onTypeComment = (v: string, skipAutocorrect = false) => {
    let finalVal = v;
    if (!skipAutocorrect && v.endsWith(" ") && !commentText.endsWith(" ")) {
      const res = applyInlineAutocorrect(v);
      if (res.corrected) {
        finalVal = res.newText;
      }
    }
    setCommentText(finalVal);
  };

  const submitComment = async () => {
    if (!user || !post || !commentText.trim() || submittingComment) return;
    setSubmittingComment(true);
    const textToSend = commentText.trim();
    setCommentText("");

    try {
      const { data, error } = await supabase
        .from("comments")
        .insert({ post_id: post.id, author_id: user.id, content: textToSend })
        .select("*, author:profiles!comments_author_id_fkey(handle, display_name, avatar_url)")
        .single();

      if (error) throw error;
      setComments((prev) => [...prev, data as unknown as CommentRow]);
      playSound("message");
      toast.success("Reply sent!");

      if (post.author?.id && post.author.id !== user.id) {
        notify({
          kind: "comment",
          title: "New Reply",
          message: `${profile?.display_name || "Someone"} replied: "${textToSend.slice(0, 50)}"`,
          actor: { id: user.id, display_name: profile?.display_name || "User", handle: profile?.handle || "user" },
          recipients: [post.author.id],
          url: `/post/${post.id}`,
        });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to post comment");
    } finally {
      setSubmittingComment(false);
    }
  };

  const deleteComment = async (commentId: string) => {
    if (!user) return;
    try {
      await supabase.from("comments").delete().eq("id", commentId).eq("author_id", user.id);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      toast.success("Reply deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen max-w-2xl mx-auto border-x border-border flex flex-col items-center justify-center p-8 text-muted-foreground gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-snap" />
        <p className="text-sm">Loading flick details…</p>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen max-w-2xl mx-auto border-x border-border flex flex-col items-center justify-center p-8 text-center space-y-4">
        <h2 className="text-xl font-bold">This post does not exist</h2>
        <p className="text-sm text-muted-foreground">It may have been deleted by the author.</p>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 rounded-full bg-snap text-black text-sm font-bold"
        >
          Go Back
        </button>
      </div>
    );
  }

  const mediaSrc = post.media_url ?? post.image_url;
  const authorTopRank = getUserTopRank(post.author?.id);
  const isAuthor = !!user && user.id === post.author?.id;

  const formattedDate = (() => {
    try {
      const d = new Date(post.created_at);
      return format(d, "h:mm a · MMM d, yyyy");
    } catch {
      return "";
    }
  })();

  return (
    <div className="min-h-screen max-w-2xl mx-auto border-x border-border bg-background pb-20">
      {/* Top Navigation Bar like X/Twitter */}
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-full hover:bg-secondary transition text-foreground"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold font-display tracking-tight leading-tight">Post</h1>
        </div>
      </header>

      {/* Main Full Post Card */}
      <article className="p-4 border-b border-border">
        {/* Author Header */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <Link
            to={post.author?.handle ? `/u/${post.author.handle}` : "#"}
            className="flex items-center gap-3 group min-w-0"
          >
            <Avatar url={post.author?.avatar_url} name={post.author?.display_name} size={48} ring />
            <div className="min-w-0 leading-tight">
              <div className="font-bold text-base flex items-center gap-1.5 truncate group-hover:underline">
                <span>{post.author?.display_name ?? "Unknown"}</span>
                {isUserVerified(post.author?.id) && <FlickVerifiedBadge size={16} />}
                {authorTopRank && <TopFlickerBadge rank={authorTopRank} size="sm" />}
              </div>
              <p className="text-sm text-muted-foreground truncate">@{post.author?.handle ?? "user"}</p>
            </div>
          </Link>

          <button
            onClick={() => setActionsOpen(true)}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-full transition"
            aria-label="More options"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>

        {/* Large Main Post Typography */}
        {post.content && (
          <div className="text-[19px] sm:text-[21px] leading-relaxed text-foreground whitespace-pre-wrap break-words font-normal my-3">
            {post.content}
          </div>
        )}

        {/* Social Embed */}
        {socialEmbed && (
          <div className="mt-3 mb-4">
            <SocialEmbedCard embed={socialEmbed} />
          </div>
        )}

        {/* Media / Video / Image */}
        {mediaSrc && (
          <div className="mt-3 mb-4 rounded-2xl overflow-hidden border border-border bg-black max-h-[600px] flex items-center justify-center relative group">
            {post.media_type === "video" ? (
              <div className="relative w-full">
                <video
                  ref={videoRef}
                  src={mediaSrc}
                  autoPlay
                  muted={muted}
                  loop
                  playsInline
                  controls
                  className="w-full max-h-[580px] object-contain"
                />
              </div>
            ) : post.media_type === "audio" ? (
              <div className="p-4 w-full bg-secondary/50">
                <audio src={mediaSrc} controls className="w-full" />
              </div>
            ) : (
              <img src={mediaSrc} alt="Post media" className="w-full max-h-[580px] object-contain" />
            )}
          </div>
        )}

        {/* Exact Timestamp & Platform Info */}
        <div className="py-3 text-sm text-muted-foreground border-b border-border/60 flex items-center gap-2 flex-wrap">
          <span>{formattedDate}</span>
          <span>·</span>
          <span className="font-medium text-foreground">Flick for Web</span>
        </div>

        {/* Detailed Twitter/X Engagement Analytics Strip */}
        <div className="py-3 px-1 border-b border-border/60 flex items-center gap-5 text-sm flex-wrap">
          {reshareCount > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-foreground">{reshareCount}</span>
              <span className="text-muted-foreground">Reposts</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-foreground">{likeCount}</span>
            <span className="text-muted-foreground">Likes</span>
          </div>
          <div className="flex items-center gap-1.5" title="Realtime verified organic views">
            <span className="font-bold text-foreground">{formatFlickViews(views)}</span>
            <span className="text-muted-foreground flex items-center gap-1">
              <Eye className="w-3.5 h-3.5 text-snap" />
              <span>Views</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-foreground">{comments.length}</span>
            <span className="text-muted-foreground">Replies</span>
          </div>
        </div>

        {/* Twitter/X Action Icons Row */}
        <div className="py-2.5 px-2 flex items-center justify-around border-b border-border/60 text-muted-foreground">
          {/* Reply */}
          <button
            onClick={() => commentInputRef.current?.focus()}
            className="p-2 rounded-full hover:bg-sky-500/10 hover:text-sky-400 transition flex items-center gap-1.5"
            title="Reply"
          >
            <MessageCircle className="w-5 h-5" />
          </button>

          {/* Repost */}
          <button
            onClick={toggleReshare}
            className={`p-2 rounded-full hover:bg-emerald-500/10 transition flex items-center gap-1.5 ${
              reshared ? "text-emerald-400" : "hover:text-emerald-400"
            }`}
            title="Repost"
          >
            <Repeat2 className="w-5 h-5" />
          </button>

          {/* Like */}
          <button
            onClick={toggleLike}
            className={`p-2 rounded-full hover:bg-rose-500/10 transition flex items-center gap-1.5 ${
              liked ? "text-rose-500" : "hover:text-rose-500"
            }`}
            title="Like"
          >
            <Heart className={`w-5 h-5 ${liked ? "fill-rose-500" : ""}`} />
          </button>

          {/* Reactions */}
          <Reactions postId={post.id} authorId={post.author?.id} postContent={post.content} />

          {/* Bookmark */}
          <button
            onClick={() => {
              setBookmarked(!bookmarked);
              toast.success(bookmarked ? "Bookmark removed" : "Added to Bookmarks");
            }}
            className={`p-2 rounded-full hover:bg-snap/10 transition flex items-center gap-1.5 ${
              bookmarked ? "text-snap" : "hover:text-snap"
            }`}
            title="Bookmark"
          >
            <Bookmark className={`w-5 h-5 ${bookmarked ? "fill-current" : ""}`} />
          </button>

          {/* Share */}
          <button
            onClick={() => setShareOpen(true)}
            className="p-2 rounded-full hover:bg-sky-500/10 hover:text-sky-400 transition"
            title="Share"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>

        {/* Reply Composer with Live Auto-Correct & Suggestions */}
        <div className="pt-4 flex gap-3 items-start">
          <Avatar url={profile?.avatar_url} name={profile?.display_name || user?.email} size={40} />
          <div className="flex-1 min-w-0">
            <textarea
              ref={commentInputRef}
              value={commentText}
              onChange={(e) => onTypeComment(e.target.value)}
              placeholder={`Post your reply to @${post.author?.handle ?? "user"}…`}
              rows={2}
              className="w-full bg-transparent text-base placeholder:text-muted-foreground resize-none focus:outline-none min-h-[50px]"
            />

            {/* Live Inline Auto-Correct Suggestion Bar */}
            <AutocorrectBar
              currentText={commentText}
              onApplyCorrection={(updated) => onTypeComment(updated, true)}
              className="rounded-xl mb-2"
            />

            <div className="flex items-center justify-between border-t border-border/50 pt-2">
              <button
                type="button"
                onClick={() => setShowEmojiPicker((v) => !v)}
                className="p-1.5 text-zinc-400 hover:text-snap rounded-full transition"
                title="Add emoji"
              >
                <Smile className="w-5 h-5" />
              </button>

              <button
                onClick={submitComment}
                disabled={!commentText.trim() || submittingComment}
                className="px-4 py-1.5 rounded-full bg-snap text-black text-sm font-bold disabled:opacity-40 hover:brightness-110 active:scale-95 transition flex items-center gap-1.5 shadow"
              >
                {submittingComment ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Reply</span>
                    <Send className="w-3.5 h-3.5 stroke-[2.5]" />
                  </>
                )}
              </button>
            </div>

            {showEmojiPicker && (
              <div className="mt-2 flex justify-center border-t border-border pt-2">
                <FullEmojiPicker
                  onSelectEmoji={(e) => {
                    setCommentText((prev) => prev + e);
                  }}
                  onClose={() => setShowEmojiPicker(false)}
                  height={240}
                  width="100%"
                />
              </div>
            )}
          </div>
        </div>
      </article>

      {/* Threaded Comments / Replies Tree */}
      <section className="divide-y divide-border">
        {comments.length === 0 ? (
          <div className="text-center py-12 px-4 text-muted-foreground space-y-2">
            <MessageCircle className="w-10 h-10 mx-auto text-muted-foreground/40 stroke-[1.5]" />
            <h3 className="font-bold text-base text-foreground">No replies yet</h3>
            <p className="text-xs">Be the first to reply to @{post.author?.handle ?? "this flick"}.</p>
          </div>
        ) : (
          comments.map((comment) => {
            const isMyComment = !!user && user.id === comment.author_id;
            return (
              <div key={comment.id} className="p-4 hover:bg-secondary/15 transition flex gap-3">
                <Link to={comment.author?.handle ? `/u/${comment.author.handle}` : "#"}>
                  <Avatar url={comment.author?.avatar_url} name={comment.author?.display_name} size={40} />
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-bold text-foreground truncate">
                      {comment.author?.display_name ?? "User"}
                    </span>
                    <span className="text-muted-foreground text-xs truncate">
                      @{comment.author?.handle ?? "user"}
                    </span>
                    <span className="text-muted-foreground text-xs">·</span>
                    <span className="text-muted-foreground text-xs">
                      {formatDistanceToNowStrict(new Date(comment.created_at))}
                    </span>
                    {isMyComment && (
                      <button
                        onClick={() => deleteComment(comment.id)}
                        className="ml-auto p-1 text-muted-foreground hover:text-destructive transition"
                        title="Delete reply"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-foreground whitespace-pre-wrap break-words">
                    {comment.content}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* Share Sheet */}
      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        postId={post.id}
        postPreview={post.content || "Check this flick"}
      />

      {/* Post Actions */}
      <PostActions
        postId={post.id}
        mediaUrl={mediaSrc}
        mediaType={post.media_type}
        open={actionsOpen}
        onClose={() => setActionsOpen(false)}
        onShare={() => setShareOpen(true)}
        isAuthor={isAuthor}
        onDelete={() => {
          navigate("/");
          toast.success("Post deleted");
        }}
      />
    </div>
  );
}
