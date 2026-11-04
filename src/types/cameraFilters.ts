export interface CameraFilter {
  id: string;
  name: string;
  tagline: string;
  cssFilter: string;
  badgeBg: string;
}

export const CAMERA_FILTERS: CameraFilter[] = [
  {
    id: "normal",
    name: "Normal",
    tagline: "Natural",
    cssFilter: "none",
    badgeBg: "from-zinc-700 to-zinc-900",
  },
  {
    id: "vintage",
    name: "Vintage",
    tagline: "70s Warmth",
    cssFilter: "sepia(0.6) contrast(1.18) brightness(0.96) saturate(1.25)",
    badgeBg: "from-amber-600 via-orange-600 to-yellow-800",
  },
  {
    id: "bw",
    name: "B&W",
    tagline: "Monochrome",
    cssFilter: "grayscale(1) contrast(1.3) brightness(1.05)",
    badgeBg: "from-zinc-200 via-zinc-500 to-zinc-900",
  },
  {
    id: "cinematic",
    name: "Cinematic",
    tagline: "Teal & Orange",
    cssFilter: "contrast(1.25) saturate(1.2) hue-rotate(-12deg) brightness(0.96)",
    badgeBg: "from-cyan-600 via-teal-700 to-amber-600",
  },
  {
    id: "noir",
    name: "Noir",
    tagline: "High Contrast",
    cssFilter: "grayscale(1) contrast(1.75) brightness(0.85)",
    badgeBg: "from-zinc-900 via-black to-zinc-800",
  },
  {
    id: "warm",
    name: "Warm Glow",
    tagline: "Golden Hour",
    cssFilter: "sepia(0.3) saturate(1.45) brightness(1.06) contrast(1.05)",
    badgeBg: "from-amber-500 via-orange-500 to-rose-600",
  },
  {
    id: "cyberpunk",
    name: "Cyberpunk",
    tagline: "Neon Night",
    cssFilter: "contrast(1.28) saturate(1.8) hue-rotate(180deg) brightness(1.05)",
    badgeBg: "from-fuchsia-600 via-purple-600 to-cyan-500",
  },
  {
    id: "fade",
    name: "Retro Fade",
    tagline: "Matte Film",
    cssFilter: "contrast(0.9) brightness(1.1) saturate(0.85) sepia(0.2)",
    badgeBg: "from-stone-500 via-stone-600 to-amber-900/60",
  },
  {
    id: "cool",
    name: "Cool Tone",
    tagline: "Nordic Clean",
    cssFilter: "hue-rotate(35deg) saturate(1.2) contrast(1.1)",
    badgeBg: "from-blue-600 via-sky-600 to-indigo-700",
  },
];
