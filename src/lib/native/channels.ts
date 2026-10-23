// Android notification channels. Created once at startup. No-op on web/iOS.
import { isNativePlatform } from "./platform";

export type ChannelId = "messages" | "likes" | "posts" | "stories" | "news";

const CHANNELS: Array<{
  id: ChannelId;
  name: string;
  description: string;
  importance: 3 | 4 | 5;
  vibration: boolean;
  sound?: string;
  visibility: -1 | 0 | 1;
  lights: boolean;
  lightColor?: string;
}> = [
  { id: "messages", name: "Messages", description: "Direct messages, replies, and reactions", importance: 5, vibration: true, visibility: 1, lights: true, lightColor: "#C5E863" },
  { id: "likes",    name: "Likes",    description: "Likes on your posts, comments and stories",  importance: 3, vibration: false, visibility: 0, lights: false },
  { id: "posts",    name: "Posts",    description: "New posts, mentions and trending",           importance: 4, vibration: true, visibility: 1, lights: true, lightColor: "#C5E863" },
  { id: "stories",  name: "Stories",  description: "Story updates, mentions and replies",         importance: 4, vibration: true, visibility: 1, lights: false },
  { id: "news",     name: "News",     description: "Breaking news and featured announcements",    importance: 4, vibration: false, visibility: 1, lights: false },
];

let created = false;
export async function ensureNotificationChannels() {
  if (created || !isNativePlatform()) return;
  created = true;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    for (const ch of CHANNELS) {
      try {
        await LocalNotifications.createChannel({
          id: ch.id,
          name: ch.name,
          description: ch.description,
          importance: ch.importance,
          visibility: ch.visibility,
          vibration: ch.vibration,
          lights: ch.lights,
          lightColor: ch.lightColor,
          sound: ch.sound,
        });
      } catch (e) {
        console.warn("[channels] failed to create", ch.id, e);
      }
    }
  } catch (e) {
    console.warn("[channels] plugin unavailable", e);
  }
}
