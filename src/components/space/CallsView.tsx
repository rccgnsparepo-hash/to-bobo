import { useState, useEffect } from "react";
import {
  Phone,
  Video,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Search,
  Plus,
  Users,
  Clock,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { triggerLightHaptic, triggerMediumHaptic } from "@/lib/haptics";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";
import { SpaceService } from "@/lib/space/spaceService";
import { ActiveCallModal, type CallType } from "@/components/chat/ActiveCallModal";
import type { CallRecord } from "@/lib/space/types";

interface PeerProfile {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
}

export function CallsView() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<PeerProfile[]>([]);
  const [callHistory, setCallHistory] = useState<CallRecord[]>(() => SpaceService.getCallHistory());
  const [search, setSearch] = useState("");
  const [activeCallPeer, setActiveCallPeer] = useState<PeerProfile | null>(null);
  const [activeCallType, setActiveCallType] = useState<CallType>("video");
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const loadPeers = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, handle, display_name, avatar_url")
        .neq("id", user.id)
        .limit(30);
      if (data) setContacts(data as PeerProfile[]);
    };
    loadPeers();

    const handleCallSync = () => setCallHistory(SpaceService.getCallHistory());
    window.addEventListener("flick:space-calls-updated", handleCallSync);
    return () => window.removeEventListener("flick:space-calls-updated", handleCallSync);
  }, [user]);

  const handleStartCall = (peer: PeerProfile, type: CallType) => {
    void triggerMediumHaptic();
    setActiveCallPeer(peer);
    setActiveCallType(type);
    setIsCallModalOpen(true);

    SpaceService.logCall({
      callerId: user?.id || "",
      callerName: "You",
      callerHandle: "me",
      recipientIds: [peer.id],
      callType: type,
      status: "connected",
    });
  };

  const filteredContacts = contacts.filter(
    (c) =>
      c.display_name.toLowerCase().includes(search.toLowerCase()) ||
      c.handle.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 w-full h-full overflow-y-auto no-scrollbar p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-blue-950/70 via-zinc-900 to-indigo-950/60 border border-blue-500/30 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
        <div className="space-y-2 text-center sm:text-left max-w-xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 font-bold text-xs border border-blue-500/30">
            <Phone className="w-3.5 h-3.5" />
            <span>DIRECT AUDIO & VIDEO CALLING</span>
          </div>
          <h2 className="font-display font-bold text-2xl sm:text-3xl text-white tracking-tight">
            Crystal-clear real-time calls
          </h2>
          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
            Call any contact with hardware-accelerated WebRTC. Switch between HD video and voice, share screens, and chat simultaneously.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contact List for Instant Calling */}
        <div className="p-5 rounded-3xl bg-card border border-border space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-base text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" />
              <span>Contacts to Call</span>
            </h3>
            <span className="text-xs text-muted-foreground font-mono">{contacts.length} peers</span>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search friends or @handles…"
              className="w-full bg-secondary/80 border border-border rounded-xl pl-9 pr-4 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="max-h-80 overflow-y-auto no-scrollbar space-y-2">
            {filteredContacts.map((contact) => (
              <div
                key={contact.id}
                className="flex items-center justify-between p-2.5 rounded-2xl bg-secondary/40 hover:bg-secondary/70 border border-border/60 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar url={contact.avatar_url} name={contact.display_name} size={40} />
                  <div className="min-w-0">
                    <div className="font-bold text-xs text-foreground truncate">
                      {contact.display_name}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      @{contact.handle}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleStartCall(contact, "audio")}
                    className="p-2 rounded-xl bg-secondary hover:bg-emerald-500/10 hover:text-emerald-500 text-foreground transition active:scale-95"
                    title="Audio Call"
                  >
                    <Phone className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStartCall(contact, "video")}
                    className="p-2 rounded-xl bg-blue-500 text-white shadow-sm hover:opacity-95 transition active:scale-95"
                    title="Video Call"
                  >
                    <Video className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Call Logs & History */}
        <div className="p-5 rounded-3xl bg-card border border-border space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-base text-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" />
              <span>Call History</span>
            </h3>
            <span className="text-xs text-muted-foreground font-mono">{callHistory.length} calls</span>
          </div>

          {callHistory.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground space-y-2">
              <PhoneOutgoing className="w-8 h-8 mx-auto text-muted-foreground/40" />
              <p>No recent call logs. Tap a contact to place your first call.</p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto no-scrollbar space-y-2">
              {callHistory.map((call) => (
                <div
                  key={call.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-secondary/40 border border-border/60 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 grid place-items-center">
                      {call.callType === "video" ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="font-bold text-foreground capitalize">{call.callType} Call</div>
                      <div className="text-[10px] text-muted-foreground">
                        {new Date(call.startedAt).toLocaleString([], {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-bold">
                    Connected
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Active Call Modal */}
      {activeCallPeer && (
        <ActiveCallModal
          open={isCallModalOpen}
          peer={activeCallPeer}
          callType={activeCallType}
          onClose={(dur) => {
            setIsCallModalOpen(false);
            setActiveCallPeer(null);
            if (dur && dur > 0) {
              toast(`Call duration: ${dur}s`);
            }
          }}
        />
      )}
    </div>
  );
}
