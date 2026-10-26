// Global persistent audio player engine.
// Ensures voice notes and audio playback continue seamlessly when switching routes or pages,
// with an interactive floating overlay mini player.

export type GlobalAudioState = {
  src: string | null;
  title: string;
  senderName: string;
  senderAvatar: string | null;
  isPlaying: boolean;
  progress: number; // 0 to 1
  currentTime: number;
  duration: number;
  isVisible: boolean;
};

let audioEl: HTMLAudioElement | null = null;
let listeners: Array<(state: GlobalAudioState) => void> = [];

let state: GlobalAudioState = {
  src: null,
  title: "Voice Message",
  senderName: "Flicker",
  senderAvatar: null,
  isPlaying: false,
  progress: 0,
  currentTime: 0,
  duration: 0,
  isVisible: false,
};

function getAudio(): HTMLAudioElement {
  if (!audioEl && typeof window !== "undefined") {
    audioEl = new Audio();
    audioEl.preload = "none";

    audioEl.addEventListener("timeupdate", () => {
      if (!audioEl) return;
      const cur = audioEl.currentTime || 0;
      const dur = audioEl.duration || 1;
      state = {
        ...state,
        currentTime: cur,
        duration: isFinite(dur) ? dur : state.duration,
        progress: cur / (isFinite(dur) && dur > 0 ? dur : 1),
      };
      notify();
    });

    audioEl.addEventListener("loadedmetadata", () => {
      if (!audioEl) return;
      state = {
        ...state,
        duration: audioEl.duration || 0,
      };
      notify();
    });

    audioEl.addEventListener("play", () => {
      state = { ...state, isPlaying: true, isVisible: true };
      notify();
    });

    audioEl.addEventListener("pause", () => {
      state = { ...state, isPlaying: false };
      notify();
    });

    audioEl.addEventListener("ended", () => {
      state = { ...state, isPlaying: false, progress: 1 };
      notify();
    });

    audioEl.addEventListener("error", (e) => {
      console.warn("[globalAudio] Audio error:", e);
      state = { ...state, isPlaying: false };
      notify();
    });
  }
  return audioEl!;
}

function notify() {
  listeners.forEach((l) => l({ ...state }));
}

export function subscribeGlobalAudio(fn: (s: GlobalAudioState) => void): () => void {
  listeners.push(fn);
  fn({ ...state });
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

export function getGlobalAudioState(): GlobalAudioState {
  return { ...state };
}

export function playGlobalAudio(params: {
  src: string;
  title?: string;
  senderName?: string;
  senderAvatar?: string | null;
}) {
  const a = getAudio();
  if (state.src === params.src && state.isPlaying) {
    a.pause();
    return;
  }

  if (state.src === params.src) {
    void a.play();
    state = { ...state, isPlaying: true, isVisible: true };
    notify();
    return;
  }

  a.preload = "auto";
  a.src = params.src;
  a.currentTime = 0;
  state = {
    src: params.src,
    title: params.title || "Voice Note",
    senderName: params.senderName || "Flicker",
    senderAvatar: params.senderAvatar || null,
    isPlaying: true,
    progress: 0,
    currentTime: 0,
    duration: 0,
    isVisible: true,
  };
  notify();
  void a.play().catch((err) => console.warn("[globalAudio] Play failed:", err));
}

export function toggleGlobalAudio() {
  const a = getAudio();
  if (!state.src) return;
  if (state.isPlaying) {
    a.pause();
  } else {
    void a.play().catch(() => {});
  }
}

export function seekGlobalAudio(fraction: number) {
  const a = getAudio();
  if (!a || !isFinite(a.duration)) return;
  const target = Math.max(0, Math.min(1, fraction)) * a.duration;
  a.currentTime = target;
}

export function closeGlobalAudio() {
  if (audioEl) {
    audioEl.pause();
  }
  state = {
    ...state,
    isPlaying: false,
    isVisible: false,
  };
  notify();
}
