import { useState } from "react";
import { ExternalLink, Play, Heart, Repeat, Sparkles } from "lucide-react";
import { type SocialEmbed } from "@/lib/socialEmbeds";
import { Avatar } from "@/components/Avatar";

export function SocialEmbedCard({ embed }: { embed: SocialEmbed }) {
  const [playingVideo, setPlayingVideo] = useState(false);

  const getPlatformBrand = () => {
    switch (embed.platform) {
      case "twitter":
        return {
          name: "X (Twitter)",
          badgeBg: "bg-black text-white border-white/20",
          cardBorder: "border-white/15",
          accentColor: "#FFFFFF",
          logo: (
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          ),
        };
      case "instagram":
        return {
          name: "Instagram",
          badgeBg: "bg-gradient-to-r from-purple-500 via-pink-500 to-amber-500 text-white border-pink-400/30",
          cardBorder: "border-pink-500/20",
          accentColor: "#E1306C",
          logo: (
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
            </svg>
          ),
        };
      case "tiktok":
        return {
          name: "TikTok",
          badgeBg: "bg-black text-cyan-400 border-cyan-400/30",
          cardBorder: "border-cyan-500/20",
          accentColor: "#00F2FE",
          logo: (
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.29 0 .58.04.85.12V9.38a6.34 6.34 0 0 0-.85-.06 6.34 6.34 0 1 0 6.34 6.35V9.48a8.28 8.28 0 0 0 5.17 1.83V7.86c-.5 0-.98-.07-1.4-.17z" />
            </svg>
          ),
        };
    }
  };

  const brand = getPlatformBrand();

  return (
    <div
      className={`mt-3 rounded-2xl overflow-hidden border ${brand.cardBorder} bg-secondary/50 hover:bg-secondary/70 transition shadow-lg relative group`}
    >
      {/* Platform Header */}
      <div className="flex items-center justify-between p-3.5 border-b border-border/50 bg-background/40">
        <div className="flex items-center gap-2.5">
          <Avatar url={embed.authorAvatar} name={embed.authorName} size={34} />
          <div className="min-w-0">
            <div className="text-xs font-bold text-foreground truncate flex items-center gap-1">
              <span>{embed.authorName}</span>
              {embed.verified && (
                <span className="w-3 h-3 rounded-full bg-blue-500 text-white flex items-center justify-center text-[8px] font-black">
                  ✓
                </span>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground truncate">
              @{embed.authorHandle}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border shadow-sm ${brand.badgeBg}`}
          >
            {brand.logo}
            <span>{brand.name}</span>
          </span>
          <a
            href={embed.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-1 text-muted-foreground hover:text-foreground transition"
            title="Open in new tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Caption Content */}
      {embed.caption && (
        <div className="p-3.5 text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
          {embed.caption}
        </div>
      )}

      {/* Media Content (Image or Video) */}
      {embed.mediaUrl && (
        <div className="relative overflow-hidden bg-black max-h-[380px] flex items-center justify-center">
          {embed.mediaType === "video" && playingVideo ? (
            <video
              src={embed.mediaUrl}
              controls
              autoPlay
              className="w-full max-h-[380px] object-contain"
            />
          ) : (
            <div
              className="relative w-full cursor-pointer group/media"
              onClick={(e) => {
                e.stopPropagation();
                if (embed.mediaType === "video") setPlayingVideo(true);
                else window.open(embed.url, "_blank");
              }}
            >
              <img
                src={embed.mediaUrl}
                alt=""
                className="w-full max-h-[380px] object-cover group-hover/media:scale-102 transition duration-300"
              />
              {embed.mediaType === "video" && (
                <div className="absolute inset-0 bg-black/35 flex items-center justify-center group-hover/media:bg-black/20 transition">
                  <div className="w-12 h-12 rounded-full bg-white/90 text-black flex items-center justify-center shadow-xl transform group-hover/media:scale-110 transition">
                    <Play className="w-5 h-5 fill-black ml-0.5" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Bottom Footer Action */}
      <div className="px-3.5 py-2.5 bg-background/30 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Heart className="w-3 h-3 text-rose-500 fill-rose-500/20" />
            <span>{(embed.likes || 1200).toLocaleString()}</span>
          </span>
          <span>•</span>
          <span className="uppercase">{embed.platform} Embed</span>
        </div>

        <a
          href={embed.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-snap hover:underline font-sans font-bold flex items-center gap-1"
        >
          <span>View on {embed.platform === "twitter" ? "X" : embed.platform}</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
