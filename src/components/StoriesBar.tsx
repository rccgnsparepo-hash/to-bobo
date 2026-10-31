import { useEffect, useState } from "react";
import { Plus, Radio, Mic } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "./Avatar";
import { SpaceService } from "@/lib/space/spaceService";
import type { LiveBroadcastSession, AudioRoom } from "@/lib/space/types";

export type StorySegment = {
  id: string;
  author_id: string;
  image_url: string;
  media_type: string | null;
  caption: string | null;
  created_at: string;
  expires_at: string;
};

export type StoryGroup = {
  author: { id: string; handle: string; display_name: string; avatar_url: string | null };
  segments: StorySegment[];
};

type Row = {
  id: string;
  author_id: string;
  image_url: string;
  media_type: string | null;
  caption: string | null;
  created_at: string;
  expires_at: string;
  author: { id: string; handle: string; display_name: string; avatar_url: string | null } | null;
};

export function StoriesBar({
  onView,
  onWatchLive,
}: {
  onView: (groups: StoryGroup[], index: number) => void;
  onWatchLive?: (session: LiveBroadcastSession) => void;
}) {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [liveSessions, setLiveSessions] = useState<LiveBroadcastSession[]>(() =>
    SpaceService.getActiveLiveSessions()
  );
  const [audioRooms, setAudioRooms] = useState<AudioRoom[]>(() =>
    SpaceService.getAudioRooms().filter((r) => r.isActive)
  );

  const load = async () => {
    const { data } = await supabase
      .from("stories")
      .select("id, author_id, image_url, media_type, caption, created_at, expires_at, author:profiles!stories_author_id_fkey (id, handle, display_name, avatar_url)")
      .order("created_at", { ascending: true })
      .limit(200);
    const rows = (data ?? []) as unknown as Row[];
    const byAuthor = new Map<string, StoryGroup>();
    rows.forEach((r) => {
      const author = r.author || { id: r.author_id, handle: "user", display_name: "Flicker", avatar_url: null };
      const g = byAuthor.get(r.author_id) ?? { author, segments: [] };
      g.segments.push({
        id: r.id,
        author_id: r.author_id,
        image_url: r.image_url,
        media_type: r.media_type,
        caption: r.caption,
        created_at: r.created_at,
        expires_at: r.expires_at,
      });
      byAuthor.set(r.author_id, g);
    });
    // newest authors first by latest segment
    setGroups([...byAuthor.values()].sort((a, b) =>
      new Date(b.segments[b.segments.length - 1].created_at).getTime() -
      new Date(a.segments[a.segments.length - 1].created_at).getTime()
    ));
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("stories-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "stories" }, load)
      .subscribe();

    const unsubLive = SpaceService.subscribeToLiveSessions((sessions) => {
      setLiveSessions(sessions.filter((s) => s.status === "live" || s.status === "starting"));
    });

    const unsubRooms = SpaceService.subscribeToRooms((rooms) => {
      setAudioRooms(rooms.filter((r) => r.isActive));
    });

    return () => {
      supabase.removeChannel(ch);
      unsubLive();
      unsubRooms();
    };
  }, []);

  return (
    <div className="flex gap-3 overflow-x-auto px-4 py-4 no-scrollbar border-b border-border">
      {/* What's Flickering / Create Story / Post */}
      <button
        type="button"
        onClick={() => {
          window.dispatchEvent(new CustomEvent("flick:open-composer"));
        }}
        className="flex flex-col items-center gap-1.5 shrink-0 group text-left cursor-pointer"
        title="What's flickering? (Create Post)"
      >
        <div className="w-16 h-16 rounded-full bg-secondary border border-dashed border-[#C5E863] grid place-items-center group-hover:bg-[#C5E863]/10 transition shadow-xs">
          <Plus className="w-6 h-6 text-[#C5E863] group-hover:scale-110 transition-transform" />
        </div>
        <span className="text-[11px] font-medium text-foreground group-hover:text-[#C5E863] transition">What's flickering?</span>
      </button>

      {/* Active Live Broadcasts - High Priority Real-Time Rings */}
      {liveSessions.map((live) => (
        <button
          key={live.id}
          type="button"
          onClick={() => {
            if (onWatchLive) onWatchLive(live);
            else navigate(`/space?tab=live`);
          }}
          className="flex flex-col items-center gap-1.5 shrink-0 group text-center cursor-pointer"
          title={`${live.hostName} is LIVE: "${live.title}"`}
        >
          <div className="w-16 h-16 rounded-full p-[2.5px] bg-gradient-to-tr from-rose-500 via-red-600 to-amber-500 animate-pulse relative shadow-md">
            <div className="w-full h-full rounded-full bg-background p-0.5 overflow-hidden relative">
              <Avatar url={live.hostAvatar} name={live.hostName} size={56} className="!rounded-full" />
              <div className="absolute inset-0 bg-red-950/20" />
            </div>
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-rose-600 text-white font-extrabold text-[9px] tracking-wider px-1.5 py-0.2 rounded-full uppercase shadow-xs flex items-center gap-0.5 border border-white/20">
              <Radio className="w-2 h-2 animate-pulse" />
              LIVE
            </span>
          </div>
          <span className="text-[11px] font-semibold text-rose-400 truncate max-w-[68px]">
            @{live.hostHandle}
          </span>
        </button>
      ))}

      {/* Active Audio Rooms */}
      {audioRooms.map((room) => (
        <button
          key={room.id}
          type="button"
          onClick={() => navigate(`/space?tab=rooms`)}
          className="flex flex-col items-center gap-1.5 shrink-0 group text-center cursor-pointer"
          title={`Audio Room: "${room.title}" hosted by ${room.hostName}`}
        >
          <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-purple-500 to-[#C5E863] relative shadow-md">
            <div className="w-full h-full rounded-full bg-background p-0.5 overflow-hidden relative">
              <Avatar url={room.hostAvatar} name={room.hostName} size={56} className="!rounded-full" />
            </div>
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-purple-600 text-white font-bold text-[8.5px] px-1.5 py-0.2 rounded-full tracking-wide shadow-xs flex items-center gap-0.5 border border-white/20">
              <Mic className="w-2 h-2 text-[#C5E863]" />
              ROOM
            </span>
          </div>
          <span className="text-[11px] font-medium text-purple-400 truncate max-w-[68px]">
            @{room.hostHandle}
          </span>
        </button>
      ))}

      {/* Stories from creators */}
      {groups.map((g, i) => (
        <button key={g.author.id} onClick={() => onView(groups, i)} className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer">
          <div className="story-ring w-16 h-16">
            <div className="w-full h-full rounded-full bg-background p-0.5 relative overflow-hidden">
              {(() => {
                const latest = g.segments[g.segments.length - 1];
                if (latest.media_type === "video" && latest.image_url) {
                  return (
                    <video
                      src={latest.image_url}
                      muted
                      playsInline
                      preload="metadata"
                      className="w-full h-full rounded-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = "none";
                      }}
                    />
                  );
                }
                if (latest.image_url) {
                  return <img src={latest.image_url} alt="" className="w-full h-full rounded-full object-cover" />;
                }
                return <Avatar url={g.author.avatar_url} name={g.author.display_name} size={56} className="!rounded-full" />;
              })()}
              <div className="absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-background">
                <Avatar url={g.author.avatar_url} name={g.author.display_name} size={20} className="!rounded-full" />
              </div>
              {g.segments.length > 1 && (
                <span className="absolute top-0 right-0 bg-[#C5E863] text-black text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
                  {g.segments.length}
                </span>
              )}
            </div>
          </div>
          <span className="text-[11px] truncate max-w-[64px]">@{g.author.handle}</span>
        </button>
      ))}
    </div>
  );
}