import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "search_users",
  title: "Search users",
  description: "Find Flick users by handle or display name.",
  inputSchema: {
    query: z.string().trim().min(1).describe("Handle or name fragment to search for."),
    limit: z.number().int().min(1).max(25).default(10).describe("Max results."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const escaped = query.replace(/[%_,]/g, "");
    const { data, error } = await supabase
      .from("profiles")
      .select("id, handle, display_name, avatar_url, bio")
      .or(`handle.ilike.%${escaped}%,display_name.ilike.%${escaped}%`)
      .limit(limit ?? 10);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { users: data ?? [] },
    };
  },
});
