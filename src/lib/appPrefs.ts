// App-wide, instantly-applied local preferences (settings screen).
import { useEffect, useState } from "react";

export type AppPrefs = {
  /** iOS-style in-app news banners */
  newsPopups: boolean;
  /** Interval between banners, seconds */
  newsIntervalSec: number;
  /** Also fire a system notification when the app is in the background */
  newsExternal: boolean;
  /** Private account */
  privateAccount: boolean;
  /** Ids marked as close friends */
  closeFriends: string[];
  /** Story authors hidden from your stories bar */
  hiddenStoryUsers: string[];
  /** Who may DM you */
  dmFrom: "everyone" | "closeFriends" | "nobody";
  /** Allow tags & mentions notifications */
  allowTags: boolean;
  /** Open the share sheet automatically after posting */
  autoShareOnPost: boolean;
  /** Daily time limit in minutes (0 = off) */
  dailyLimitMin: number;
  /** Screen time security PIN (default 1234) */
  screenTimePin: string;
  /** Your own posts hidden from your profile grid */
  archivedPosts: string[];
  /** Who can reply to your stories */
  storyRepliesFrom: "everyone" | "closeFriends" | "off";
  /** Show activity online status */
  showActivityStatus: boolean;
  /** Show read receipts */
  readReceipts: boolean;
  /** Notification categories */
  notificationsDMs: boolean;
  notificationsLikes: boolean;
  notificationsFlickers: boolean;
  notificationsComments: boolean;
  notificationsStories: boolean;
  /** Tablet optimization */
  tabletAdaptiveLayout: boolean;
  tabletSideBySideFeed: boolean;
};

export const DEFAULT_APP_PREFS: AppPrefs = {
  newsPopups: true,
  newsIntervalSec: 29,
  newsExternal: true,
  privateAccount: false,
  closeFriends: [],
  hiddenStoryUsers: [],
  dmFrom: "everyone",
  allowTags: true,
  autoShareOnPost: false,
  dailyLimitMin: 0,
  screenTimePin: "1234",
  archivedPosts: [],
  storyRepliesFrom: "everyone",
  showActivityStatus: true,
  readReceipts: true,
  notificationsDMs: true,
  notificationsLikes: true,
  notificationsFlickers: true,
  notificationsComments: true,
  notificationsStories: true,
  tabletAdaptiveLayout: true,
  tabletSideBySideFeed: false,
};

const KEY = "flick:app-prefs";
const EVT = "flick:app-prefs-changed";

export function readAppPrefs(): AppPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_APP_PREFS, ...(JSON.parse(raw) as Partial<AppPrefs>) } : DEFAULT_APP_PREFS;
  } catch {
    return DEFAULT_APP_PREFS;
  }
}

export function writeAppPrefs(p: AppPrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* noop */
  }
  window.dispatchEvent(new Event(EVT));
}

export function useAppPrefs() {
  const [prefs, setPrefs] = useState<AppPrefs>(readAppPrefs);
  useEffect(() => {
    const sync = () => setPrefs(readAppPrefs());
    window.addEventListener(EVT, sync);
    return () => window.removeEventListener(EVT, sync);
  }, []);
  const update = (patch: Partial<AppPrefs>) => {
    const next = { ...readAppPrefs(), ...patch };
    writeAppPrefs(next);
    setPrefs(next);
  };
  return { prefs, update };
}

/**
 * Returns false if the user toggled off the specific notification category in Settings
 */
export function isNotificationCategoryEnabled(kind: string): boolean {
  const p = readAppPrefs();
  const normalized = (kind || "").toLowerCase();
  switch (normalized) {
    case "message":
    case "chat":
    case "dm":
    case "typing":
      return p.notificationsDMs;
    case "like":
    case "reaction":
      return p.notificationsLikes;
    case "flicker":
    case "follow":
      return p.notificationsFlickers;
    case "comment":
    case "reply":
      return p.notificationsComments;
    case "story":
      return p.notificationsStories;
    case "news":
      return p.newsPopups;
    default:
      return true;
  }
}
