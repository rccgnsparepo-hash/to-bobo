import { useEffect, useRef } from "react";
import { startUsageTracking } from "@/lib/usage";
import { ScreenTimeLockout } from "./ScreenTimeLockout";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { triggerNotchNotification } from "./notifications/NotchNotification";
import { notificationAudio } from "@/lib/notificationAudio";
import { initPresenceTracking, recordUserActivity } from "@/lib/presence";
import { sendDesktopNotification, requestDesktopNotificationPermission, playNotificationChime } from "@/lib/realtimeNotifications";

export function SystemLifeCycle() {
  const { user } = useAuth();
  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const lastTypingBannerMapRef = useRef<Map<string, number>>(new Map());

  // 1. Continuous Screen Time Tracking (Web, Electron EXE, Capacitor APK)
  useEffect(() => {
    const cleanup = startUsageTracking();
    return cleanup;
  }, []);

  // 2. Realtime Presence Tracking: announces this user as online
  useEffect(() => {
    if (!user?.id) return;
    const cleanup = initPresenceTracking(user.id);
    return cleanup;
  }, [user?.id]);

  // 3. Request desktop notification permission softly in the background
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      const timer = setTimeout(() => {
        void requestDesktopNotificationPermission();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, []);

  // 4. Real-Time Instant Push & Typing Notifications Everywhere Across App
  // (Works on Home, News, Profile, Comics, Camera, Backgrounded, Electron EXE, PWA, Web)
  useEffect(() => {
    if (!user) return;

    // Helper to test if user is currently looking at this exact thread in the foreground
    const isActivelyChattingWith = (senderId: string) => {
      if (typeof window === "undefined") return false;
      const onThread = window.location.pathname === `/messages/${senderId}`;
      const isVisible = document.visibilityState === "visible" && document.hasFocus();
      return onThread && isVisible;
    };

    // Helper to fire the full notification pipeline (Notch, Sound, OS Notification, Electron)
    const deliverIncomingMessageAlert = (msg: {
      id: string;
      senderId: string;
      senderName: string;
      senderHandle?: string;
      senderAvatar?: string | null;
      content?: string | null;
      mediaType?: string | null;
    }) => {
      // 1. Mark sender active in real-time
      recordUserActivity(msg.senderId);

      // 2. Always dispatch unread counter update so badge increments in realtime everywhere
      window.dispatchEvent(
        new CustomEvent("flick:dm-unread-updated", {
          detail: { increment: 1, senderId: msg.senderId },
        })
      );

      if (seenMessageIdsRef.current.has(msg.id)) return;
      seenMessageIdsRef.current.add(msg.id);

      // Clean up set if too big
      if (seenMessageIdsRef.current.size > 200) {
        const arr = Array.from(seenMessageIdsRef.current).slice(-100);
        seenMessageIdsRef.current = new Set(arr);
      }

      // If user is actively in this thread right now, skip banner/push
      if (isActivelyChattingWith(msg.senderId)) return;

      const chatUrl = `/messages/${msg.senderId}`;
      const senderName = msg.senderName || msg.senderHandle || "Someone";

      let messageSnippet = msg.content || "";
      if (!messageSnippet) {
        if (msg.mediaType === "audio") messageSnippet = "Sent you a voice note 🎙️";
        else if (msg.mediaType === "image") messageSnippet = "Sent you a Flick photo 📸";
        else if (msg.mediaType === "video") messageSnippet = "Sent you a Flick video 🎥";
        else messageSnippet = "Sent you a Flick ⚡️";
      }

      // 1. Spoken audio notification and chime
      void notificationAudio.playNotificationAudio("message", {
        id: msg.senderId,
        handle: msg.senderHandle || "user",
        display_name: senderName,
      });
      playNotificationChime();

      // 2. In-app top notch notification banner
      triggerNotchNotification({
        kind: "message",
        title: senderName,
        message: messageSnippet,
        url: chatUrl,
        actor: {
          id: msg.senderId,
          handle: msg.senderHandle || "user",
          display_name: senderName,
          avatar_url: msg.senderAvatar,
        },
      });

      // 3. Native Windows / Electron Tray Toast (OR browser notification if not Electron)
      if (typeof window !== "undefined" && window.electronAPI?.showNotification) {
        window.electronAPI.showNotification({
          title: `Flick · ${senderName}`,
          body: messageSnippet,
          url: chatUrl,
        });
        window.electronAPI.flashFrame();
      } else {
        // OS Desktop / PWA Browser Notification API only when Electron bridge is absent
        sendDesktopNotification({
          title: `Flick · ${senderName}`,
          body: messageSnippet,
          icon: msg.senderAvatar || "/icon-192.png",
          tag: `dm-${msg.senderId}-${msg.id}`,
          url: chatUrl,
          onClick: () => {
            window.focus();
            window.location.href = chatUrl;
          },
        });
      }
    };

    // Helper to process typing presence: STRICT RULE: in-app presence only, NEVER persistent OS/desktop alerts or chimes
    const deliverTypingAlert = (data: {
      senderId: string;
      displayName?: string;
      handle?: string;
      avatarUrl?: string | null;
      isTyping?: boolean;
    }) => {
      if (!data.senderId || data.senderId === user.id) return;

      // 1. Mark sender active in real-time
      recordUserActivity(data.senderId);

      // 2. Forward strictly to in-app chat list & active thread listeners (no desktop notifications or chimes)
      window.dispatchEvent(new CustomEvent("flick:dm-typing-update", { detail: data }));
    };

    // A. Direct Real-time Message Broadcast channel (instant delivery)
    const directDmChannel = supabase
      .channel(`dm-events-${user.id}`)
      .on("broadcast", { event: "new-message" }, (evt) => {
        const payload = evt.payload as {
          id: string;
          sender_id: string;
          senderName?: string;
          senderHandle?: string;
          senderAvatar?: string | null;
          content?: string | null;
          media_type?: string | null;
        };
        if (!payload || !payload.sender_id) return;

        deliverIncomingMessageAlert({
          id: payload.id || `dm-${Date.now()}`,
          senderId: payload.sender_id,
          senderName: payload.senderName || "Someone",
          senderHandle: payload.senderHandle,
          senderAvatar: payload.senderAvatar,
          content: payload.content,
          mediaType: payload.media_type,
        });
      })
      .subscribe();

    // B. Postgres WAL Changes on `messages` table for this recipient
    const msgTableChannel = supabase
      .channel(`user-realtime-messages-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${user.id}`,
        },
        async (payload) => {
          const newMsg = payload.new as {
            id: string;
            sender_id: string;
            content?: string;
            media_type?: string;
            media_url?: string;
          };

          if (!newMsg || !newMsg.sender_id) return;
          if (seenMessageIdsRef.current.has(newMsg.id)) return;

          // Fetch sender profile details
          const { data: sender } = await supabase
            .from("profiles")
            .select("id, handle, display_name, avatar_url")
            .eq("id", newMsg.sender_id)
            .maybeSingle();

          deliverIncomingMessageAlert({
            id: newMsg.id,
            senderId: newMsg.sender_id,
            senderName: sender?.display_name || sender?.handle || "Someone",
            senderHandle: sender?.handle || "user",
            senderAvatar: sender?.avatar_url,
            content: newMsg.content,
            mediaType: newMsg.media_type,
          });
        }
      )
      .subscribe();

    // C. Real-time typing listener (active across all pages of the app)
    const typingChannel = supabase
      .channel(`dm-typing-${user.id}`)
      .on("broadcast", { event: "user-typing" }, (payload) => {
        const data = payload.payload as {
          senderId?: string;
          displayName?: string;
          handle?: string;
          avatarUrl?: string | null;
          isTyping?: boolean;
        };
        if (data?.senderId) {
          deliverTypingAlert({
            senderId: data.senderId,
            displayName: data.displayName,
            handle: data.handle,
            avatarUrl: data.avatarUrl,
            isTyping: data.isTyping !== false,
          });
        }
      })
      .subscribe();

    // D. Initial check on mount / reconnect for unread messages
    const checkUnread = async () => {
      try {
        const { count: unreadMsgs } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("recipient_id", user.id)
          .is("read_at", null);

        if (unreadMsgs && unreadMsgs > 0 && !window.location.pathname.startsWith("/messages")) {
          const title = "Unread Messages";
          const body = `You have ${unreadMsgs} unread message${unreadMsgs > 1 ? "s" : ""} on Flick`;
          if (typeof window !== "undefined" && window.electronAPI?.showNotification) {
            window.electronAPI.showNotification({
              title,
              body,
              url: "/messages",
            });
            window.electronAPI.flashFrame();
          }
        }
      } catch {
        /* ignore */
      }
    };

    void checkUnread();
    window.addEventListener("online", checkUnread);
    window.addEventListener("flick:system-resume", checkUnread);

    return () => {
      supabase.removeChannel(directDmChannel);
      supabase.removeChannel(msgTableChannel);
      supabase.removeChannel(typingChannel);
      window.removeEventListener("online", checkUnread);
      window.removeEventListener("flick:system-resume", checkUnread);
    };
  }, [user]);

  return <ScreenTimeLockout />;
}
