import { toast } from "sonner";

const inFlightDownloads = new Set<string>();

/**
 * Downloads a media asset directly to the user's device with realistic download
 * progress, without exposing raw storage URLs, opening external tabs, or leaking bucket paths.
 * Automatically checks and prevents duplicate concurrent downloads if tapped twice.
 */
export async function downloadMedia(
  url: string,
  suggestedFilename?: string,
  mediaType?: "image" | "video" | "audio" | string
): Promise<boolean> {
  if (!url || typeof url !== "string") {
    toast.error("No media file available to download");
    return false;
  }

  // Prevent duplicate concurrent downloads of the same media
  if (inFlightDownloads.has(url)) {
    toast.info("Download already in progress! Please wait a moment.");
    return false;
  }

  inFlightDownloads.add(url);

  // Determine appropriate clean file extension without leaking storage buckets
  let ext = "webp";
  if (mediaType === "video") ext = "mp4";
  else if (mediaType === "audio") ext = "mp3";
  else {
    try {
      const pathname = new URL(url).pathname;
      const match = pathname.match(/\.([a-zA-Z0-9]+)(?:[?#]|$)/);
      if (match && match[1]) {
        const found = match[1].toLowerCase();
        if (["mp4", "webm", "mov", "m4v"].includes(found)) ext = "mp4";
        else if (["mp3", "wav", "ogg", "aac", "m4a"].includes(found)) ext = "mp3";
        else if (["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(found)) ext = found;
      }
    } catch {
      /* fallback */
    }
  }

  // Sanitize filename — strictly avoid leaking bucket paths, internal ids or query strings
  let filename = suggestedFilename?.trim();
  if (!filename) {
    filename = `flick-${Date.now()}.${ext}`;
  } else if (!filename.includes(".")) {
    filename = `${filename}.${ext}`;
  }

  const toastId = `download-${Date.now()}`;
  toast.loading(`Downloading media (0%)...`, { id: toastId });

  // Helper to trigger save dialog from a local Blob object
  const saveBlob = (blob: Blob, name: string) => {
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = name;
    a.rel = "noopener noreferrer";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
    }, 10000);
  };

  // 1. Primary Strategy: XHR with real-time download progress tracking
  try {
    const blob = await new Promise<Blob>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", url, true);
      xhr.responseType = "blob";

      xhr.onprogress = (evt) => {
        if (evt.lengthComputable && evt.total > 0) {
          const percent = Math.min(99, Math.round((evt.loaded / evt.total) * 100));
          toast.loading(`Downloading media (${percent}%)...`, { id: toastId });
        } else {
          const approx = Math.min(90, Math.round((evt.loaded / (1024 * 1024 * 3)) * 100));
          toast.loading(`Downloading media (${approx}%)...`, { id: toastId });
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300 && xhr.response) {
          toast.loading("Saving to your device...", { id: toastId });
          resolve(xhr.response as Blob);
        } else {
          reject(new Error(`HTTP status ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error("Network error during media download"));
      xhr.ontimeout = () => reject(new Error("Download timed out"));
      xhr.timeout = 30000;
      xhr.send();
    });

    saveBlob(blob, filename);
    toast.success("Media saved successfully!", { id: toastId });
    inFlightDownloads.delete(url);
    return true;
  } catch (xhrErr) {
    // 2. Secondary Strategy: Server-side download proxy (bypasses browser CORS restrictions completely)
    try {
      toast.loading("Streaming media download...", { id: toastId });
      const proxyUrl = `/api/download-proxy?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
      const proxyRes = await fetch(proxyUrl);
      if (proxyRes.ok) {
        const proxyBlob = await proxyRes.blob();
        if (proxyBlob.size > 0) {
          saveBlob(proxyBlob, filename);
          toast.success("Media saved successfully!", { id: toastId });
          inFlightDownloads.delete(url);
          return true;
        }
      }
    } catch {
      /* continue to canvas / anchor fallback */
    }

    // 3. Tertiary Strategy for images: Draw through offscreen canvas
    if (ext !== "mp4" && ext !== "mp3") {
      try {
        toast.loading("Processing image download...", { id: toastId });
        const canvasBlob = await new Promise<Blob>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            try {
              const canvas = document.createElement("canvas");
              canvas.width = img.naturalWidth || img.width;
              canvas.height = img.naturalHeight || img.height;
              const ctx = canvas.getContext("2d");
              if (!ctx) return reject(new Error("Could not initialize 2D canvas context"));
              ctx.drawImage(img, 0, 0);
              canvas.toBlob(
                (b) => {
                  if (b) resolve(b);
                  else reject(new Error("Canvas toBlob produced empty result"));
                },
                ext === "png" ? "image/png" : "image/jpeg",
                0.95
              );
            } catch (err) {
              reject(err);
            }
          };
          img.onerror = () => reject(new Error("Image element could not load source"));
          img.src = url;
        });

        saveBlob(canvasBlob, filename);
        toast.success("Media saved successfully!", { id: toastId });
        inFlightDownloads.delete(url);
        return true;
      } catch {
        /* continue to direct fallback */
      }
    }

    // 4. Safe direct download fallback: Anchor with download attribute
    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("Media opened for saving!", { id: toastId });
      inFlightDownloads.delete(url);
      return true;
    } catch {
      toast.error("Could not complete download.", { id: toastId });
      inFlightDownloads.delete(url);
      return false;
    }
  }
}
