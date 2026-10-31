import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";
import { handleSecurityMiddleware } from "./src/server/securityApiHandler";

function wallpaperApiProxyPlugin() {
  return {
    name: "wallpaper-api-proxy",
    configureServer(server: any) {
      server.middlewares.use("/api/wallpapers", async (req: any, res: any) => {
        try {
          const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
          const q = (url.searchParams.get("q") || "").trim();
          const category = (url.searchParams.get("category") || "all").trim();
          const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
          const searchTerm = q || (category !== "all" && category !== "All" ? category : "toplist");
          
          const rawResults: any[] = [];
          
          // 1. Query Wallhaven (Real human-curated 4K/8K community wallpapers with multi-page support)
          try {
            const isTop = searchTerm === "toplist" || searchTerm === "all";
            const whUrl = isTop
              ? `https://wallhaven.cc/api/v1/search?sorting=toplist&purity=100&page=${page}`
              : `https://wallhaven.cc/api/v1/search?q=${encodeURIComponent(searchTerm)}&purity=100&sorting=toplist&page=${page}`;
            const whRes = await fetch(whUrl, {
              headers: { "User-Agent": "FlickCommunityApp/1.0" },
            });
            if (whRes.ok) {
              const whData = await whRes.json();
              for (const item of (whData.data || []).slice(0, 30)) {
                const uploader = item.uploader?.username ? `@${item.uploader.username}` : "Wallhaven Artist";
                const uploaderAvatar = `https://images.unsplash.com/photo-${1535713875002 + ((item.id?.charCodeAt(0) || 0) % 200)}?w=120&auto=format&fit=crop&q=80`;
                rawResults.push({
                  id: "wh_" + item.id,
                  title: item.tags?.slice(0, 3).map((t: any) => t.name).join(" • ") || `${searchTerm} 4K Wallpaper`,
                  imageUrl: item.path,
                  thumbnailUrl: item.thumbs?.large || item.thumbs?.small || item.path,
                  author: uploader,
                  authorAvatar: uploaderAvatar,
                  creator: {
                    name: uploader,
                    handle: uploader.startsWith("@") ? uploader : `@${uploader}`,
                    avatar: uploaderAvatar,
                  },
                  source: "Wallhaven (Real 4K)",
                  resolution: item.resolution || "3840x2160",
                  likes: item.favorites || Math.floor(Math.random() * 450) + 120,
                  views: item.views || Math.floor(Math.random() * 6000) + 1000,
                  category: category !== "all" && category !== "All" ? category : "Wallhaven Curated",
                  tags: [searchTerm, item.category || "Art", item.resolution || "4K", "Ultra HD 4K"],
                  downloadUrl: item.path,
                  aspectRatio: (item.dimension_y || 2160) > (item.dimension_x || 3840) ? "tall" : "wide",
                });
              }
            }
          } catch (whErr) {
            console.error("Wallhaven fetch failed:", whErr);
          }

          // 2. Query WallpaperCave (Real community wallpapers with page offset)
          try {
            const wcQuery = searchTerm === "toplist" || searchTerm === "all" ? "4k wallpapers" : searchTerm;
            const wcUrl = `https://wallpapercave.com/search?q=${encodeURIComponent(wcQuery)}&page=${page}`;
            const wcRes = await fetch(wcUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
            if (wcRes.ok) {
              const html = await wcRes.text();
              const re = /<img[^>]+(src|data-src)="([^"]+)"[^>]*alt="([^"]*)"/gi;
              let m;
              let count = 0;
              while ((m = re.exec(html)) !== null && count < 24) {
                const src = m[2];
                const alt = m[3] || searchTerm;
                if (!src.includes("/wp/") && !src.includes("/wpt/") && !src.includes("/fuwp") && !src.includes("/uwp/")) continue;
                const full = src.replace("/fuwp-255/", "/uwp/").replace("/wpt/", "/wp/").replace("/wpm/", "/wp/");
                const thumb = src.startsWith("/") ? "https://wallpapercave.com" + src : src;
                const fullUrl = full.startsWith("/") ? "https://wallpapercave.com" + full : full;
                const uploader = "WallpaperCave Community";
                const uploaderAvatar = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80";
                rawResults.push({
                  id: "wc_p" + page + "_" + count + "_" + Math.random().toString(36).slice(2, 7),
                  title: alt.length > 60 ? alt.slice(0, 60) + "..." : alt,
                  imageUrl: fullUrl,
                  thumbnailUrl: thumb,
                  author: uploader,
                  authorAvatar: uploaderAvatar,
                  creator: {
                    name: uploader,
                    handle: "@wc_community",
                    avatar: uploaderAvatar,
                  },
                  source: "WallpaperCave",
                  resolution: "1920x1080 Full HD",
                  likes: Math.floor(Math.random() * 320) + 70,
                  views: Math.floor(Math.random() * 3500) + 400,
                  category: category !== "all" && category !== "All" ? category : "WallpaperCave",
                  tags: [searchTerm, "WallpaperCave", "Community Favorite"],
                  downloadUrl: fullUrl,
                  aspectRatio: "wide",
                });
                count++;
              }
            }
          } catch (wcErr) {
            console.error("WallpaperCave fetch failed:", wcErr);
          }

          // Strict internal deduplication per page
          const seenKeys = new Set();
          const deduped: any[] = [];
          for (const item of rawResults) {
            const key = item.imageUrl ? item.imageUrl.split("?")[0].toLowerCase() : item.id;
            if (!seenKeys.has(key) && !seenKeys.has(item.id)) {
              seenKeys.add(key);
              seenKeys.add(item.id);
              deduped.push(item);
            }
          }

          res.setHeader("Content-Type", "application/json");
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.end(JSON.stringify({ wallpapers: deduped, count: deduped.length, page }));
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: err.message, wallpapers: [], page }));
        }
      });
    },
  };
}

function registrationSecurityPlugin() {
  const handler = async (req: any, res: any, next: any) => {
    try {
      const handled = await handleSecurityMiddleware(req, res);
      if (!handled) {
        next();
      }
    } catch (err) {
      next(err);
    }
  };

  return {
    name: "registration-security-api",
    configureServer(server: any) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server: any) {
      server.middlewares.use(handler);
    },
  };
}

export default defineConfig({
  server: { host: "0.0.0.0", port: 3000, allowedHosts: true, hmr: false },
  plugins: [
    registrationSecurityPlugin(),
    wallpaperApiProxyPlugin(),
    react(),
    tailwindcss(),
    tsconfigPaths(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      strategies: "generateSW",
      filename: "sw.js",
      devOptions: { enabled: false },
      includeAssets: [
        "icon-192.png",
        "icon-512.png",
        "apple-touch-icon.png",
        "offline.html",
        "OneSignalSDKWorker.js",
        "robots.txt",
      ],
      manifest: false, // we ship /manifest.webmanifest by hand
      workbox: {
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//, /^\/functions\//],
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webp,woff2}"],
        // Never let Workbox intercept the OneSignal SW file — it must be served fresh.
        navigateFallbackAllowlist: [/^(?!\/OneSignalSDKWorker\.js).*/],
        runtimeCaching: [
          {
            // Google Fonts / CDN assets
            urlPattern: ({ url }) => /fonts\.(gstatic|googleapis)\.com$/.test(url.hostname),
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Public storage media (avatars, post images). Same-origin Supabase Storage public bucket.
            urlPattern: ({ url }) => url.pathname.startsWith("/storage/v1/object/public/"),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "media-public",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // HTML navigations: network first, fall back to cache, then offline page.
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "html-nav",
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
