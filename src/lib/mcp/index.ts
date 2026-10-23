import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getMyProfile from "./tools/get-my-profile";
import listFeed from "./tools/list-feed";
import createPost from "./tools/create-post";
import searchUsers from "./tools/search-users";
import listNotifications from "./tools/list-notifications";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "snap-x",
  title: "Snap X",
  version: "0.1.0",
  instructions:
    "Tools for Flick (Snap X), a social app. Read the signed-in user's profile and notifications, browse the feed, search users by handle, and publish text posts.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getMyProfile, listFeed, createPost, searchUsers, listNotifications],
});
