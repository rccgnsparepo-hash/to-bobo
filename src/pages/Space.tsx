import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { SpaceHeader } from "@/components/space/SpaceHeader";
import { LiveBroadcastView } from "@/components/space/LiveBroadcastView";
import { LiveWatchView } from "@/components/space/LiveWatchView";
import { GoLiveModal } from "@/components/space/GoLiveModal";
import { AudioRoomsView } from "@/components/space/AudioRoomsView";
import { CallsView } from "@/components/space/CallsView";
import { ClassroomView } from "@/components/space/ClassroomView";
import { PrepClassView } from "@/components/space/PrepClassView";
import { RecordingsView } from "@/components/space/RecordingsView";
import { ScheduleView } from "@/components/space/ScheduleView";
import { DiscoverView } from "@/components/space/DiscoverView";
import { SpaceService } from "@/lib/space/spaceService";
import { useAuth } from "@/lib/auth";
import type { SpaceTab, LiveBroadcastSession } from "@/lib/space/types";

export default function SpacePage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get("tab") as SpaceTab) || "live";

  const [activeTab, setActiveTab] = useState<SpaceTab>(initialTab);
  const [goLiveModalOpen, setGoLiveModalOpen] = useState(false);
  const [watchingSession, setWatchingSession] = useState<LiveBroadcastSession | null>(null);

  const [liveSessions, setLiveSessions] = useState<LiveBroadcastSession[]>(() =>
    SpaceService.getLiveSessions().filter((s) => s.status === "live" || s.status === "starting")
  );
  const [roomsCount, setRoomsCount] = useState<number>(() => SpaceService.getRooms().length);

  // Sync tab with URL
  const handleTabChange = (tab: SpaceTab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  useEffect(() => {
    const unsubLive = SpaceService.subscribeToLiveSessions((sessions) => {
      setLiveSessions(sessions.filter((s) => s.status === "live" || s.status === "starting"));
    });

    const unsubRooms = SpaceService.subscribeToRooms((rooms) => {
      setRoomsCount(rooms.length);
    });

    return () => {
      unsubLive();
      unsubRooms();
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col pb-20 md:pb-8">
      {/* Space Header with Real-Time Tabs & Badges */}
      <SpaceHeader
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onStartGoLive={() => setGoLiveModalOpen(true)}
        activeLiveCount={liveSessions.length}
        activeRoomsCount={roomsCount}
      />

      {/* Main Tab Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6">
        {activeTab === "live" && (
          <LiveBroadcastView
            onJoinAsViewer={(session) => {
              if (user && session.hostId === user.id) {
                // Host returns to broadcaster studio
                setActiveTab("live");
              } else {
                setWatchingSession(session);
              }
            }}
            onRequestGoLiveModal={() => setGoLiveModalOpen(true)}
          />
        )}

        {activeTab === "rooms" && <AudioRoomsView />}

        {activeTab === "calls" && <CallsView />}

        {activeTab === "classes" && <ClassroomView />}

        {activeTab === "prep" && <PrepClassView />}

        {activeTab === "recordings" && <RecordingsView />}

        {activeTab === "schedule" && <ScheduleView />}

        {activeTab === "discover" && (
          <DiscoverView
            onSelectTab={handleTabChange}
            onWatchLive={(broadcast) => {
              if (user && broadcast.hostId === user.id) {
                handleTabChange("live");
              } else {
                setWatchingSession(broadcast);
              }
            }}
          />
        )}
      </main>

      {/* Full-Screen Live Stream Viewer Modal */}
      {watchingSession && (
        <LiveWatchView
          session={watchingSession}
          onClose={() => setWatchingSession(null)}
        />
      )}

      {/* Broadcaster Go-Live Configuration Modal */}
      <GoLiveModal
        isOpen={goLiveModalOpen}
        onClose={() => setGoLiveModalOpen(false)}
        onConfirmGoLive={(_title, _category, _visibility) => {
          setGoLiveModalOpen(false);
          setActiveTab("live");
          // Let LiveBroadcastView handle hardware stream start
          window.dispatchEvent(
            new CustomEvent("flick:start-broadcast", {
              detail: { title: _title, category: _category, visibility: _visibility },
            })
          );
        }}
      />
    </div>
  );
}
