import React, { useState, useEffect } from "react";
import {
  Search,
  Radio,
  Users,
  BookOpen,
  Sparkles,
  ArrowRight,
  Filter,
  CheckCircle2,
} from "lucide-react";
import { SpaceService } from "@/lib/space/spaceService";
import type { LiveBroadcastSession, AudioRoom, ClassroomSession } from "@/lib/space/types";

interface DiscoverViewProps {
  onSelectTab: (tab: any) => void;
  onWatchLive: (broadcast: LiveBroadcastSession) => void;
}

export const DiscoverView: React.FC<DiscoverViewProps> = ({ onSelectTab, onWatchLive }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<"all" | "live" | "rooms" | "classes">("all");
  const [liveStreams, setLiveStreams] = useState<LiveBroadcastSession[]>([]);
  const [audioRooms, setAudioRooms] = useState<AudioRoom[]>([]);
  const [classes, setClasses] = useState<ClassroomSession[]>([]);

  useEffect(() => {
    // Subscribe to live broadcast updates
    const unsubLive = SpaceService.subscribeToLiveSessions((sessions) => {
      setLiveStreams(sessions);
    });

    // Subscribe to audio rooms
    const unsubRooms = SpaceService.subscribeToRooms((rooms) => {
      setAudioRooms(rooms);
    });

    // Fetch classes
    SpaceService.getActiveClassrooms().then(setClasses);

    return () => {
      unsubLive();
      unsubRooms();
    };
  }, []);

  // Filter items
  const query = searchQuery.toLowerCase().trim();

  const filteredLive = liveStreams.filter((s) =>
    query ? s.title.toLowerCase().includes(query) || s.hostName.toLowerCase().includes(query) : true
  );

  const filteredRooms = audioRooms.filter((r) =>
    query ? r.title.toLowerCase().includes(query) || r.hostName.toLowerCase().includes(query) : true
  );

  const filteredClasses = classes.filter((c) =>
    query ? c.title.toLowerCase().includes(query) || c.teacherName.toLowerCase().includes(query) : true
  );

  return (
    <div className="space-y-6">
      {/* Search & Filter Header */}
      <div className="p-6 bg-[#14151a] rounded-2xl border border-white/5 space-y-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-lime-400" />
            Discover Flick Space
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Explore live video broadcasts, conversational audio spaces, real-time online classes, and study groups.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by topic, speaker, or title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-black/50 border border-white/10 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-lime-400 transition-colors"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setSelectedFilter("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedFilter === "all"
                  ? "bg-lime-400 text-black"
                  : "bg-white/5 text-zinc-400 hover:text-white"
              }`}
            >
              All Channels
            </button>
            <button
              onClick={() => setSelectedFilter("live")}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedFilter === "live"
                  ? "bg-rose-500 text-white"
                  : "bg-white/5 text-zinc-400 hover:text-white"
              }`}
            >
              <Radio className="w-3 h-3" />
              Live Streams ({liveStreams.length})
            </button>
            <button
              onClick={() => setSelectedFilter("rooms")}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedFilter === "rooms"
                  ? "bg-purple-500 text-white"
                  : "bg-white/5 text-zinc-400 hover:text-white"
              }`}
            >
              <Users className="w-3 h-3" />
              Audio Rooms ({audioRooms.length})
            </button>
            <button
              onClick={() => setSelectedFilter("classes")}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedFilter === "classes"
                  ? "bg-blue-500 text-white"
                  : "bg-white/5 text-zinc-400 hover:text-white"
              }`}
            >
              <BookOpen className="w-3 h-3" />
              Classes ({classes.length})
            </button>
          </div>
        </div>
      </div>

      {/* Live Broadcasts Section */}
      {(selectedFilter === "all" || selectedFilter === "live") && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
              Live Video Broadcasts ({filteredLive.length})
            </h3>
            {filteredLive.length > 0 && (
              <button
                onClick={() => onSelectTab("live")}
                className="text-xs text-lime-400 hover:underline flex items-center gap-1"
              >
                View Live Hub <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>

          {filteredLive.length === 0 ? (
            <div className="p-6 rounded-2xl bg-[#0f1014] border border-white/5 text-center">
              <p className="text-xs text-zinc-400">No active video broadcasts currently running.</p>
              <button
                onClick={() => onSelectTab("live")}
                className="mt-2 text-xs text-lime-400 font-bold hover:underline"
              >
                Be the first to Go Live &rarr;
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredLive.map((stream) => (
                <div
                  key={stream.id}
                  onClick={() => onWatchLive(stream)}
                  className="group relative bg-[#14151a] border border-white/5 hover:border-lime-400/50 rounded-2xl p-4 cursor-pointer transition-all hover:scale-[1.01]"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-[10px] font-bold flex items-center gap-1">
                      <Radio className="w-2.5 h-2.5 animate-pulse" />
                      LIVE
                    </span>
                    <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {stream.viewerCount} watching
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-white line-clamp-1 group-hover:text-lime-400 transition-colors">
                    {stream.title}
                  </h4>

                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
                    <div className="w-6 h-6 rounded-full bg-lime-400/20 text-lime-400 font-bold text-[10px] flex items-center justify-center">
                      {stream.hostName.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs text-zinc-300 font-medium truncate">
                      {stream.hostName}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Audio Rooms Section */}
      {(selectedFilter === "all" || selectedFilter === "rooms") && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-400" />
              Interactive Audio Rooms ({filteredRooms.length})
            </h3>
            {filteredRooms.length > 0 && (
              <button
                onClick={() => onSelectTab("rooms")}
                className="text-xs text-lime-400 hover:underline flex items-center gap-1"
              >
                All Audio Spaces <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>

          {filteredRooms.length === 0 ? (
            <div className="p-6 rounded-2xl bg-[#0f1014] border border-white/5 text-center">
              <p className="text-xs text-zinc-400">No audio spaces currently in session.</p>
              <button
                onClick={() => onSelectTab("rooms")}
                className="mt-2 text-xs text-purple-400 font-bold hover:underline"
              >
                Start an Audio Room &rarr;
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRooms.map((room) => (
                <div
                  key={room.id}
                  onClick={() => onSelectTab("rooms")}
                  className="bg-[#14151a] border border-white/5 hover:border-purple-500/50 rounded-2xl p-4 cursor-pointer transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-[10px] font-bold">
                      {room.category.toUpperCase()}
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      {room.speakers.length + room.listeners.length} participants
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white">{room.title}</h4>
                  <p className="text-xs text-zinc-400 mt-2">Hosted by {room.hostName}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Classes Section */}
      {(selectedFilter === "all" || selectedFilter === "classes") && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-400" />
              Live & Upcoming Online Classes ({filteredClasses.length})
            </h3>
            {filteredClasses.length > 0 && (
              <button
                onClick={() => onSelectTab("classes")}
                className="text-xs text-lime-400 hover:underline flex items-center gap-1"
              >
                Classroom Hub <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>

          {filteredClasses.length === 0 ? (
            <div className="p-6 rounded-2xl bg-[#0f1014] border border-white/5 text-center">
              <p className="text-xs text-zinc-400">No scheduled classes at this moment.</p>
              <button
                onClick={() => onSelectTab("classes")}
                className="mt-2 text-xs text-blue-400 font-bold hover:underline"
              >
                Schedule or Start a Class &rarr;
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredClasses.map((cls) => (
                <div
                  key={cls.id}
                  onClick={() => onSelectTab("classes")}
                  className="bg-[#14151a] border border-white/5 hover:border-blue-500/50 rounded-2xl p-4 cursor-pointer transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold">
                      {cls.subject}
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      {cls.enrolledStudents.length} enrolled
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white">{cls.title}</h4>
                  <p className="text-xs text-zinc-400 mt-2">Instructor: {cls.teacherName}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
