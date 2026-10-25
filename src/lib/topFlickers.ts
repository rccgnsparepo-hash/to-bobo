import { supabase } from "@/integrations/supabase/client";

export type TopFlicker = {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  rank: number;
  flicksCount: number;
  recentFlicksCount: number;
  likesReceived: number;
  commentsReceived: number;
  resharesReceived: number;
  engagementScore: number;
  badgeTitle: string;
  badgeIcon: string;
  badgeColor: string;
  haloColor: string;
};

// High-fidelity fallback creators if the database has sparse initial activity
const FALLBACK_TOP_CREATORS: Omit<TopFlicker, "rank">[] = [
  {
    id: "flick_master_1",
    handle: "flickking",
    display_name: "Apex King",
    avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    bio: "Reigning #1 Grandmaster Flicker 👑 Daily stories & street art",
    flicksCount: 84,
    recentFlicksCount: 26,
    likesReceived: 412,
    commentsReceived: 128,
    resharesReceived: 62,
    engagementScore: 3680,
    badgeTitle: "#1 Grandmaster",
    badgeIcon: "👑",
    badgeColor: "from-amber-400 via-yellow-300 to-amber-500",
    haloColor: "rgba(245, 158, 11, 0.45)",
  },
  {
    id: "flick_master_2",
    handle: "cybernova",
    display_name: "Nova Neon",
    avatar_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    bio: "Rank #2 Diamond Elite 💎 Cyber aesthetics & photography",
    flicksCount: 65,
    recentFlicksCount: 19,
    likesReceived: 310,
    commentsReceived: 94,
    resharesReceived: 45,
    engagementScore: 2840,
    badgeTitle: "#2 Diamond Elite",
    badgeIcon: "💎",
    badgeColor: "from-cyan-400 via-teal-300 to-blue-500",
    haloColor: "rgba(6, 182, 212, 0.45)",
  },
  {
    id: "flick_master_3",
    handle: "vibecheck",
    display_name: "Vibe Pulse",
    avatar_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
    bio: "Rank #3 Apex Striker ⚡️ Realtime updates & beats",
    flicksCount: 52,
    recentFlicksCount: 15,
    likesReceived: 240,
    commentsReceived: 78,
    resharesReceived: 31,
    engagementScore: 2190,
    badgeTitle: "#3 Apex Striker",
    badgeIcon: "⚡️",
    badgeColor: "from-lime-400 via-emerald-300 to-green-500",
    haloColor: "rgba(197, 232, 99, 0.45)",
  },
  {
    id: "flick_master_4",
    handle: "pixelrebel",
    display_name: "Pixel Rebel",
    avatar_url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
    bio: "Rank #4 Hall of Fame 🔥 Pixel comics & animation",
    flicksCount: 41,
    recentFlicksCount: 11,
    likesReceived: 185,
    commentsReceived: 62,
    resharesReceived: 24,
    engagementScore: 1670,
    badgeTitle: "#4 Hall of Fame",
    badgeIcon: "🔥",
    badgeColor: "from-rose-500 via-purple-500 to-indigo-500",
    haloColor: "rgba(244, 63, 94, 0.4)",
  },
];

let cachedTopFlickers: TopFlicker[] | null = null;
let lastFetchTime = 0;

/**
 * Calculates top flickers ranking using:
 * - Real user profiles
 * - Recent flicks (last 14 days have higher weight)
 * - Engagement: Likes received (4 pts), Comments received (6 pts), Reshares received (10 pts)
 */
export async function fetchTopFlickers(forceRefresh = false): Promise<TopFlicker[]> {
  const now = Date.now();
  if (!forceRefresh && cachedTopFlickers && now - lastFetchTime < 30000) {
    return cachedTopFlickers;
  }

  try {
    // 1. Fetch all profiles
    const { data: profiles, error: pErr } = await supabase
      .from("profiles")
      .select("id, handle, display_name, avatar_url, bio")
      .limit(50);

    if (pErr || !profiles || profiles.length === 0) {
      cachedTopFlickers = FALLBACK_TOP_CREATORS.map((c, i) => ({ ...c, rank: i + 1 }));
      lastFetchTime = now;
      return cachedTopFlickers;
    }

    // 2. Fetch posts with creation dates to evaluate recency
    const { data: posts, error: postErr } = await supabase
      .from("posts")
      .select("id, author_id, created_at");

    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    
    // Map post ID to author ID
    const postAuthorMap: Record<string, string> = {};
    const flicksCountByUser: Record<string, number> = {};
    const recentFlicksCountByUser: Record<string, number> = {};

    (posts ?? []).forEach((p) => {
      if (p.author_id) {
        postAuthorMap[p.id] = p.author_id;
        flicksCountByUser[p.author_id] = (flicksCountByUser[p.author_id] || 0) + 1;
        if (p.created_at && p.created_at >= fourteenDaysAgo) {
          recentFlicksCountByUser[p.author_id] = (recentFlicksCountByUser[p.author_id] || 0) + 1;
        }
      }
    });

    // 3. Fetch engagement data: likes, comments, reshares
    const [likesRes, commentsRes, resharesRes] = await Promise.all([
      supabase.from("likes").select("post_id"),
      supabase.from("comments").select("post_id"),
      supabase.from("reshares").select("post_id"),
    ]);

    const likesReceivedByUser: Record<string, number> = {};
    (likesRes.data ?? []).forEach((like) => {
      const authorId = postAuthorMap[like.post_id];
      if (authorId) {
        likesReceivedByUser[authorId] = (likesReceivedByUser[authorId] || 0) + 1;
      }
    });

    const commentsReceivedByUser: Record<string, number> = {};
    (commentsRes.data ?? []).forEach((comment) => {
      const authorId = postAuthorMap[comment.post_id];
      if (authorId) {
        commentsReceivedByUser[authorId] = (commentsReceivedByUser[authorId] || 0) + 1;
      }
    });

    const resharesReceivedByUser: Record<string, number> = {};
    (resharesRes.data ?? []).forEach((reshare) => {
      const authorId = postAuthorMap[reshare.post_id];
      if (authorId) {
        resharesReceivedByUser[authorId] = (resharesReceivedByUser[authorId] || 0) + 1;
      }
    });

    // 4. Calculate dynamic engagement score for each profile
    const scoredProfiles = profiles.map((p) => {
      const totalFlicks = flicksCountByUser[p.id] || 0;
      const recentFlicks = recentFlicksCountByUser[p.id] || 0;
      const likes = likesReceivedByUser[p.id] || 0;
      const comments = commentsReceivedByUser[p.id] || 0;
      const reshares = resharesReceivedByUser[p.id] || 0;

      // Algorithm:
      // - 10 pts per total flick
      // - 15 pts extra per recent flick (fresh content bonus)
      // - 4 pts per like received
      // - 6 pts per comment received (deeper conversation engagement)
      // - 10 pts per reshare received (viral reach)
      const engagementScore =
        totalFlicks * 10 +
        recentFlicks * 15 +
        likes * 4 +
        comments * 6 +
        reshares * 10;

      return {
        profile: p,
        totalFlicks,
        recentFlicks,
        likes,
        comments,
        reshares,
        engagementScore,
      };
    });

    // Sort descending by engagementScore
    scoredProfiles.sort((a, b) => b.engagementScore - a.engagementScore);

    // If active profiles with content exist, format them
    const activeProfiles = scoredProfiles.filter((sp) => sp.engagementScore > 0);

    let finalTopList: TopFlicker[] = [];

    if (activeProfiles.length >= 3) {
      finalTopList = activeProfiles.slice(0, 10).map((sp, idx) => {
        const rank = idx + 1;
        const p = sp.profile;
        const { badgeTitle, badgeIcon, badgeColor, haloColor } = getRankStyling(rank);

        return {
          id: p.id,
          handle: p.handle,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          bio: p.bio,
          rank,
          flicksCount: sp.totalFlicks,
          recentFlicksCount: sp.recentFlicks,
          likesReceived: sp.likes,
          commentsReceived: sp.comments,
          resharesReceived: sp.reshares,
          engagementScore: sp.engagementScore,
          badgeTitle,
          badgeIcon,
          badgeColor,
          haloColor,
        };
      });
    } else {
      // Blend real active profiles at the top and backfill with vibrant fallbacks
      const activeMapped: TopFlicker[] = activeProfiles.map((sp, idx) => {
        const rank = idx + 1;
        const p = sp.profile;
        const { badgeTitle, badgeIcon, badgeColor, haloColor } = getRankStyling(rank);
        return {
          id: p.id,
          handle: p.handle,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          bio: p.bio,
          rank,
          flicksCount: sp.totalFlicks,
          recentFlicksCount: sp.recentFlicks,
          likesReceived: sp.likes,
          commentsReceived: sp.comments,
          resharesReceived: sp.reshares,
          engagementScore: sp.engagementScore,
          badgeTitle,
          badgeIcon,
          badgeColor,
          haloColor,
        };
      });

      const remainingSlots = 10 - activeMapped.length;
      const backfill = FALLBACK_TOP_CREATORS.slice(0, remainingSlots).map((fb, i) => {
        const rank = activeMapped.length + i + 1;
        const { badgeTitle, badgeIcon, badgeColor, haloColor } = getRankStyling(rank);
        return {
          ...fb,
          rank,
          badgeTitle,
          badgeIcon,
          badgeColor,
          haloColor,
        };
      });

      finalTopList = [...activeMapped, ...backfill];
    }

    cachedTopFlickers = finalTopList;
    lastFetchTime = now;
    return cachedTopFlickers;
  } catch (err) {
    console.warn("Error calculating top flickers engagement:", err);
    cachedTopFlickers = FALLBACK_TOP_CREATORS.map((c, i) => ({ ...c, rank: i + 1 }));
    lastFetchTime = now;
    return cachedTopFlickers;
  }
}

function getRankStyling(rank: number) {
  if (rank === 1) {
    return {
      badgeTitle: "#1 Grandmaster",
      badgeIcon: "👑",
      badgeColor: "from-amber-400 via-yellow-300 to-amber-500",
      haloColor: "rgba(245, 158, 11, 0.5)",
    };
  }
  if (rank === 2) {
    return {
      badgeTitle: "#2 Diamond Elite",
      badgeIcon: "💎",
      badgeColor: "from-cyan-400 via-teal-300 to-blue-500",
      haloColor: "rgba(6, 182, 212, 0.5)",
    };
  }
  if (rank === 3) {
    return {
      badgeTitle: "#3 Apex Striker",
      badgeIcon: "⚡️",
      badgeColor: "from-lime-400 via-emerald-300 to-green-500",
      haloColor: "rgba(197, 232, 99, 0.5)",
    };
  }
  return {
    badgeTitle: `#${rank} Hall of Fame`,
    badgeIcon: "🔥",
    badgeColor: "from-rose-500 via-purple-500 to-indigo-500",
    haloColor: "rgba(244, 63, 94, 0.4)",
  };
}

export function getRankBadgeMeta(rank: number) {
  if (rank === 1) {
    return { title: "#1 Grandmaster", icon: "👑", bg: "bg-amber-400 text-black border-amber-300", glow: "shadow-amber-500/40" };
  }
  if (rank === 2) {
    return { title: "#2 Diamond", icon: "💎", bg: "bg-cyan-400 text-black border-cyan-300", glow: "shadow-cyan-500/40" };
  }
  if (rank === 3) {
    return { title: "#3 Apex", icon: "⚡️", bg: "bg-lime-400 text-black border-lime-300", glow: "shadow-lime-500/40" };
  }
  return { title: `#${rank} Top`, icon: "🔥", bg: "bg-rose-500 text-white border-rose-400", glow: "shadow-rose-500/30" };
}

export function getUserTopRank(userId?: string | null): number | null {
  if (!userId) return null;
  if (!cachedTopFlickers) {
    const found = FALLBACK_TOP_CREATORS.findIndex((c) => c.id === userId);
    return found >= 0 ? found + 1 : null;
  }
  const found = cachedTopFlickers.find((c) => c.id === userId);
  return found ? found.rank : null;
}
