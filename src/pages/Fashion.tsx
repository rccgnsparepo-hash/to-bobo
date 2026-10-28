import { useState, useRef, useEffect } from "react";
import {
  ArrowLeft,
  Heart,
  Plus,
  Minus,
  RotateCw,
  Sparkles,
  Bookmark,
  Share2,
  X,
  Check,
  ChevronRight,
  Shirt,
  Layers,
  Palette,
  Download,
  MessageCircle,
  Scissors,
  DollarSign,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { downloadMedia } from "@/lib/downloadMedia";
import { triggerLightHaptic, triggerMediumHaptic } from "@/lib/haptics";
import { playSound } from "@/lib/soundEngine";
import { useNavigate } from "react-router-dom";

export interface OutfitPiece {
  id: string;
  category: "top" | "bottom" | "shoes";
  name: string;
  priceUSD: number;
  priceCNY: number;
  priceNGN: number;
  imageUrl: string;
  brandOrStyle: string;
}

export interface OutfitPreset {
  id: string;
  name: string;
  occasion: string;
  swatches: string[]; // 2-3 color hexes
  thumbnailUrl: string;
  // Visual avatar layers for different angles (0 = front, 90 = side, 180 = back, 270 = other side)
  angles: {
    front: string;
    side: string;
    back: string;
  };
  top: OutfitPiece;
  bottom: OutfitPiece;
  shoes: OutfitPiece;
  stylingRule: string;
  likes: number;
}

export interface AvatarModel {
  id: string;
  name: string;
  gender: "female" | "male";
  avatarThumb: string;
  bio: string;
}

const AVATAR_MODELS: AvatarModel[] = [
  {
    id: "mei",
    name: "Mei",
    gender: "female",
    avatarThumb: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80",
    bio: "College sophomore • Acubi & Streetwear aesthetic",
  },
  {
    id: "kai",
    name: "Kai",
    gender: "male",
    avatarThumb: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80",
    bio: "Campus senior • Tailored smart casual & techwear",
  },
  {
    id: "zara",
    name: "Zara",
    gender: "female",
    avatarThumb: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop&q=80",
    bio: "Arts major • Vintage knitwear & modern traditional",
  },
  {
    id: "leo",
    name: "Leo",
    gender: "male",
    avatarThumb: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80",
    bio: "Athlete & creator • Heavyweight athleisure & varsity",
  },
];

const HAIRSTYLES = [
  { id: "twin_braids", name: "Twin Braids / Pigtails", icon: "👧" },
  { id: "wavy_bob", name: "Wavy Bob", icon: "💇‍♀️" },
  { id: "afro_curls", name: "Natural Curls / Afro", icon: "✨" },
  { id: "sleek_bun", name: "Sleek High Bun", icon: "👱‍♀️" },
  { id: "fringe", name: "Curtain Fringe", icon: "🧝‍♀️" },
];

export const OUTFIT_PRESETS: OutfitPreset[] = [
  {
    id: "acubi_fairy",
    name: "Acubi fairy",
    occasion: "Campus & Street",
    swatches: ["#D4B996", "#8C6D53"],
    thumbnailUrl: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=300&q=80",
    angles: {
      front: "/assets/aistudio/download__38__1d85c90f.jpg",
      side: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=85",
      back: "/assets/aistudio/download__38__1d85c90f.jpg",
    },
    top: {
      id: "top-acubi",
      category: "top",
      name: "Oversized Cable Tie-Back Cardigan",
      priceUSD: 32,
      priceCNY: 32,
      priceNGN: 48000,
      imageUrl: "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=160&auto=format&fit=crop&q=80",
      brandOrStyle: "Chunky Knitwear",
    },
    bottom: {
      id: "btm-acubi",
      category: "bottom",
      name: "High-Waist Tiered Linen Skort",
      priceUSD: 40,
      priceCNY: 40,
      priceNGN: 60000,
      imageUrl: "https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=160&auto=format&fit=crop&q=80",
      brandOrStyle: "A-Line Skirt",
    },
    shoes: {
      id: "shoe-acubi",
      category: "shoes",
      name: "Chunky Platform Suede Boots",
      priceUSD: 65,
      priceCNY: 420,
      priceNGN: 98000,
      imageUrl: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=160&auto=format&fit=crop&q=80",
      brandOrStyle: "Platform Boots",
    },
    stylingRule: "Tonal Earth Harmony: Warm camel and sand knitwear balanced with stacked socks and lug-sole boots.",
    likes: 842,
  },
  {
    id: "kpop_idol",
    name: "KPOP idol",
    occasion: "Performance & Party",
    swatches: ["#FF8C00", "#1A1A1A", "#FFFFFF"],
    thumbnailUrl: "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=300&q=80",
    angles: {
      front: "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=800&q=85",
      side: "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=800&q=85",
      back: "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=800&q=85",
    },
    top: {
      id: "top-kpop",
      category: "top",
      name: "Crop Utility Windbreaker with Neon Panels",
      priceUSD: 48,
      priceCNY: 340,
      priceNGN: 72000,
      imageUrl: "https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?w=160&auto=format&fit=crop&q=80",
      brandOrStyle: "Stage Techwear",
    },
    bottom: {
      id: "btm-kpop",
      category: "bottom",
      name: "Pleated Contrast Cargo Mini Shorts",
      priceUSD: 36,
      priceCNY: 260,
      priceNGN: 54000,
      imageUrl: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=160&auto=format&fit=crop&q=80",
      brandOrStyle: "Buckle Cargo",
    },
    shoes: {
      id: "shoe-kpop",
      category: "shoes",
      name: "White Chunky High-Top Trainers",
      priceUSD: 85,
      priceCNY: 590,
      priceNGN: 125000,
      imageUrl: "https://images.unsplash.com/photo-1552346154-21d32810aba3?w=160&auto=format&fit=crop&q=80",
      brandOrStyle: "High Tops",
    },
    stylingRule: "High-Contrast Statement: Let the vivid orange accent pop against monochromatic black straps.",
    likes: 1240,
  },
  {
    id: "street_casual",
    name: "Street casual",
    occasion: "Campus Lecture",
    swatches: ["#FFFFFF", "#2B2D42", "#8D99AE"],
    thumbnailUrl: "https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?auto=format&fit=crop&w=300&q=80",
    angles: {
      front: "https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?auto=format&fit=crop&w=800&q=85",
      side: "https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?auto=format&fit=crop&w=800&q=85",
      back: "https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?auto=format&fit=crop&w=800&q=85",
    },
    top: {
      id: "top-street",
      category: "top",
      name: "Boxy Heavyweight Drop-Shoulder Tee",
      priceUSD: 28,
      priceCNY: 198,
      priceNGN: 42000,
      imageUrl: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=160&auto=format&fit=crop&q=80",
      brandOrStyle: "Vintage Wash",
    },
    bottom: {
      id: "btm-street",
      category: "bottom",
      name: "Relaxed Carpenter Raw Denim",
      priceUSD: 52,
      priceCNY: 370,
      priceNGN: 78000,
      imageUrl: "https://images.unsplash.com/photo-1542272604-780c96856592?w=160&auto=format&fit=crop&q=80",
      brandOrStyle: "Carpenter Denim",
    },
    shoes: {
      id: "shoe-street",
      category: "shoes",
      name: "Adidas Samba OG / Retro Court Sneakers",
      priceUSD: 100,
      priceCNY: 720,
      priceNGN: 150000,
      imageUrl: "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=160&auto=format&fit=crop&q=80",
      brandOrStyle: "Low-Profile Kicks",
    },
    stylingRule: "The Sandwich Rule: Balance the upper white silhouette with clean white/gum-sole footwear below.",
    likes: 980,
  },
  {
    id: "cyber_aesthetic",
    name: "Cyber aesthetic",
    occasion: "Friday Rave",
    swatches: ["#111111", "#FFD700", "#708090"],
    thumbnailUrl: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=300&q=80",
    angles: {
      front: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=85",
      side: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=85",
      back: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=85",
    },
    top: {
      id: "top-cyber",
      category: "top",
      name: "Technical Utility Vest with Chrome Clasps",
      priceUSD: 60,
      priceCNY: 430,
      priceNGN: 90000,
      imageUrl: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=160&auto=format&fit=crop&q=80",
      brandOrStyle: "Techwear Vest",
    },
    bottom: {
      id: "btm-cyber",
      category: "bottom",
      name: "Parachute Bungee Drawcord Cargo",
      priceUSD: 58,
      priceCNY: 410,
      priceNGN: 87000,
      imageUrl: "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=160&auto=format&fit=crop&q=80",
      brandOrStyle: "Parachute Tech",
    },
    shoes: {
      id: "shoe-cyber",
      category: "shoes",
      name: "Chunky Lug-Sole Combat Boots",
      priceUSD: 110,
      priceCNY: 790,
      priceNGN: 165000,
      imageUrl: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=160&auto=format&fit=crop&q=80",
      brandOrStyle: "Lug Soles",
    },
    stylingRule: "Metallic Clash: Matte black ripstop nylon accented with cyber silver chains and reflective tags.",
    likes: 1120,
  },
  {
    id: "class_presentation",
    name: "Class formal",
    occasion: "Class Presentation",
    swatches: ["#2C3539", "#FFFFFF", "#C5A059"],
    thumbnailUrl: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=300&q=80",
    angles: {
      front: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=800&q=85",
      side: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=800&q=85",
      back: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=800&q=85",
    },
    top: {
      id: "top-pres",
      category: "top",
      name: "Unstructured Oversized Slate Blazer",
      priceUSD: 75,
      priceCNY: 530,
      priceNGN: 112000,
      imageUrl: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=160&auto=format&fit=crop&q=80",
      brandOrStyle: "Smart Tailored",
    },
    bottom: {
      id: "btm-pres",
      category: "bottom",
      name: "Wide-Leg Pleated Tailored Trousers",
      priceUSD: 48,
      priceCNY: 340,
      priceNGN: 72000,
      imageUrl: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=160&auto=format&fit=crop&q=80",
      brandOrStyle: "Pleated Trousers",
    },
    shoes: {
      id: "shoe-pres",
      category: "shoes",
      name: "Polished Black Leather Penny Loafers",
      priceUSD: 95,
      priceCNY: 670,
      priceNGN: 142000,
      imageUrl: "https://images.unsplash.com/photo-1614252369475-531eba835eb1?w=160&auto=format&fit=crop&q=80",
      brandOrStyle: "Classic Loafers",
    },
    stylingRule: "The High-Low Balance: Structured formal upper paired with relaxed, modern wide trousers and white crew socks.",
    likes: 760,
  },
  {
    id: "cultural_senator",
    name: "Naija Heritage",
    occasion: "Cultural Day",
    swatches: ["#1B365D", "#FFFFFF", "#8B4513"],
    thumbnailUrl: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=300&q=80",
    angles: {
      front: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=85",
      side: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=85",
      back: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=85",
    },
    top: {
      id: "top-senator",
      category: "top",
      name: "Contemporary Senator Tunic with Geometric Embroidery",
      priceUSD: 68,
      priceCNY: 480,
      priceNGN: 95000,
      imageUrl: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=160&auto=format&fit=crop&q=80",
      brandOrStyle: "Handmade Senator",
    },
    bottom: {
      id: "btm-senator",
      category: "bottom",
      name: "Crisp Tapered Linen Trousers",
      priceUSD: 45,
      priceCNY: 320,
      priceNGN: 65000,
      imageUrl: "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=160&auto=format&fit=crop&q=80",
      brandOrStyle: "Tapered Linen",
    },
    shoes: {
      id: "shoe-senator",
      category: "shoes",
      name: "Handcrafted Burnished Leather Mules",
      priceUSD: 78,
      priceCNY: 550,
      priceNGN: 110000,
      imageUrl: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=160&auto=format&fit=crop&q=80",
      brandOrStyle: "Leather Mules",
    },
    stylingRule: "Focal Contrast Rule: Rich deep navy tunic embroidery paired with crisp white pants and coral wrist beads.",
    likes: 1490,
  },
];

export default function FashionPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarModel>(AVATAR_MODELS[0]);
  const [selectedHairstyle, setSelectedHairstyle] = useState(HAIRSTYLES[0]);
  const [currentPreset, setCurrentPreset] = useState<OutfitPreset>(OUTFIT_PRESETS[0]);
  const [rotationAngle, setRotationAngle] = useState(0); // 0 front, 90 side, 180 back
  const [zoomLevel, setZoomLevel] = useState(1);
  const [currency, setCurrency] = useState<"USD" | "CNY" | "NGN">("CNY");
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(OUTFIT_PRESETS[0].likes);
  const [showDrawer, setShowDrawer] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [inspectingPiece, setInspectingPiece] = useState<OutfitPiece | null>(null);

  // Drag interaction state
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const currentAngleRef = useRef(0);

  // Sync ref
  useEffect(() => {
    currentAngleRef.current = rotationAngle;
  }, [rotationAngle]);

  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    startXRef.current = e.clientX;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const deltaX = e.clientX - startXRef.current;
    if (Math.abs(deltaX) > 4) {
      const newAngle = (currentAngleRef.current + deltaX * 0.85) % 360;
      setRotationAngle(newAngle < 0 ? newAngle + 360 : newAngle);
      startXRef.current = e.clientX;
    }
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  const handlePresetSelect = (preset: OutfitPreset) => {
    void triggerMediumHaptic();
    try {
      playSound("message_sent");
    } catch {}
    setCurrentPreset(preset);
    setIsLiked(false);
    setLikeCount(preset.likes);
  };

  const cycleHairstyle = () => {
    void triggerLightHaptic();
    const idx = HAIRSTYLES.findIndex((h) => h.id === selectedHairstyle.id);
    const next = HAIRSTYLES[(idx + 1) % HAIRSTYLES.length];
    setSelectedHairstyle(next);
    toast(`Hairstyle: ${next.name}`);
  };

  const stepRotation = (delta: number) => {
    void triggerLightHaptic();
    setRotationAngle((prev) => {
      const next = (prev + delta) % 360;
      return next < 0 ? next + 360 : next;
    });
  };

  const formatPrice = (piece: OutfitPiece) => {
    if (currency === "CNY") return `¥ ${piece.priceCNY}`;
    if (currency === "NGN") return `₦ ${piece.priceNGN.toLocaleString()}`;
    return `$ ${piece.priceUSD}`;
  };

  const handlePostToFeed = async () => {
    if (!user) {
      toast.error("Please sign in to share to your Flick feed");
      return;
    }
    try {
      const content = `Styled this "${currentPreset.name}" look in Flick Fashion Fitting Room! ✨\n\nTop: ${currentPreset.top.name}\nBottom: ${currentPreset.bottom.name}\nShoes: ${currentPreset.shoes.name}\n\nRule: ${currentPreset.stylingRule}`;
      const { error } = await supabase.from("posts").insert({
        author_id: user.id,
        content,
        image_url: currentPreset.angles.front,
        media_url: currentPreset.angles.front,
        media_type: "image",
      });
      if (error) throw error;
      toast.success("Outfit posted to your Flick feed! 🔥");
      setShowDrawer(false);
      window.dispatchEvent(new CustomEvent("flick:feed-refresh"));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  // Determine which image view to render based on rotation angle
  const normalizedDeg = ((rotationAngle % 360) + 360) % 360;
  const isBackView = normalizedDeg > 110 && normalizedDeg < 250;
  const isSideView = (normalizedDeg >= 50 && normalizedDeg <= 110) || (normalizedDeg >= 250 && normalizedDeg <= 300);

  const displayAvatarImage = isBackView
    ? currentPreset.angles.back
    : isSideView
    ? currentPreset.angles.side
    : currentPreset.angles.front;

  return (
    <div className="relative w-full h-[100dvh] max-h-[100dvh] overflow-hidden bg-[#e5e5e7] dark:bg-[#121316] select-none text-foreground flex flex-col font-sans">
      {/* Dynamic Background Studio Glow */}
      <div
        className="absolute inset-0 pointer-events-none transition-colors duration-700 opacity-60"
        style={{
          background: `radial-gradient(circle at 50% 40%, ${currentPreset.swatches[0]}33 0%, transparent 65%)`,
        }}
      />

      {/* Top Bar (Matches Video & Screenshot) */}
      <header className="relative z-30 flex items-center justify-between px-5 pt-4 pb-2">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="w-10 h-10 rounded-full bg-white/70 dark:bg-zinc-800/80 backdrop-blur-md border border-black/5 dark:border-white/10 grid place-items-center text-foreground hover:scale-105 active:scale-95 transition shadow-sm"
          title="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="text-center">
          <h1 className="font-display font-bold text-base sm:text-lg text-zinc-900 dark:text-zinc-100 tracking-tight">
            Outfit assistant
          </h1>
          <p className="text-[10px] uppercase font-extrabold tracking-wider text-rose-500">
            {currentPreset.occasion}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Like Heart */}
          <button
            type="button"
            onClick={() => {
              void triggerLightHaptic();
              setIsLiked(!isLiked);
              setLikeCount((prev) => (isLiked ? prev - 1 : prev + 1));
            }}
            className="w-10 h-10 rounded-full bg-white/70 dark:bg-zinc-800/80 backdrop-blur-md border border-black/5 dark:border-white/10 grid place-items-center text-foreground hover:scale-105 active:scale-95 transition shadow-sm"
            title="Like outfit"
          >
            <Heart
              className={`w-5 h-5 transition-colors ${
                isLiked ? "fill-rose-500 text-rose-500 scale-110" : "text-zinc-600 dark:text-zinc-300"
              }`}
            />
          </button>

          {/* Currency Toggle (¥ / $ / ₦) */}
          <button
            type="button"
            onClick={() => {
              void triggerLightHaptic();
              setCurrency((c) => (c === "CNY" ? "USD" : c === "USD" ? "NGN" : "CNY"));
            }}
            className="w-10 h-10 rounded-full bg-white/70 dark:bg-zinc-800/80 backdrop-blur-md border border-black/5 dark:border-white/10 grid place-items-center text-xs font-bold font-mono text-zinc-700 dark:text-zinc-200 hover:scale-105 active:scale-95 transition shadow-sm"
            title="Toggle currency"
          >
            {currency === "CNY" ? "¥" : currency === "USD" ? "$" : "₦"}
          </button>
        </div>
      </header>

      {/* Main 3D Viewport Stage */}
      <main
        className="relative flex-1 w-full flex items-center justify-center overflow-hidden touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Left HUD: Avatar Model & Hairstyle Selector (Matches Screenshot) */}
        <div className="absolute top-3 left-4 z-20 flex flex-col gap-3">
          {/* Avatar Profile Bubble */}
          <button
            type="button"
            onClick={() => setShowAvatarPicker(true)}
            className="flex flex-col items-center group active:scale-95 transition"
            title="Switch Avatar Model"
          >
            <div className="w-12 h-12 rounded-2xl overflow-hidden bg-white dark:bg-zinc-800 p-0.5 border-2 border-white/80 dark:border-zinc-700 shadow-md group-hover:ring-2 group-hover:ring-rose-400">
              <img
                src={selectedAvatar.avatarThumb}
                alt={selectedAvatar.name}
                className="w-full h-full object-cover rounded-xl"
              />
            </div>
            <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-200 mt-1 drop-shadow-sm">
              {selectedAvatar.name}
            </span>
          </button>

          {/* Hairstyle Toggle Icon */}
          <button
            type="button"
            onClick={cycleHairstyle}
            className="w-12 h-12 rounded-2xl bg-white/80 dark:bg-zinc-800/80 backdrop-blur-md border border-black/5 dark:border-white/10 grid place-items-center shadow-md hover:scale-105 active:scale-95 transition"
            title={`Current: ${selectedHairstyle.name} (Tap to change)`}
          >
            <span className="text-xl">{selectedHairstyle.icon}</span>
          </button>
        </div>

        {/* Right HUD: Zoom & Rotate Controls (Matches Screenshot) */}
        <div className="absolute top-24 right-4 z-20 flex flex-col gap-2">
          {/* Zoom In */}
          <button
            type="button"
            onClick={() => {
              void triggerLightHaptic();
              setZoomLevel((z) => Math.min(1.3, z + 0.1));
            }}
            className="w-10 h-10 rounded-2xl bg-white/80 dark:bg-zinc-800/80 backdrop-blur-md border border-black/5 dark:border-white/10 grid place-items-center text-zinc-700 dark:text-zinc-200 shadow-md hover:scale-105 active:scale-95 transition"
            title="Zoom in"
          >
            <Plus className="w-4 h-4" />
          </button>

          {/* Zoom Out */}
          <button
            type="button"
            onClick={() => {
              void triggerLightHaptic();
              setZoomLevel((z) => Math.max(0.85, z - 0.1));
            }}
            className="w-10 h-10 rounded-2xl bg-white/80 dark:bg-zinc-800/80 backdrop-blur-md border border-black/5 dark:border-white/10 grid place-items-center text-zinc-700 dark:text-zinc-200 shadow-md hover:scale-105 active:scale-95 transition"
            title="Zoom out"
          >
            <Minus className="w-4 h-4" />
          </button>

          {/* 360° Quick Rotate */}
          <button
            type="button"
            onClick={() => stepRotation(90)}
            className="w-10 h-10 rounded-2xl bg-white/80 dark:bg-zinc-800/80 backdrop-blur-md border border-black/5 dark:border-white/10 grid place-items-center text-zinc-700 dark:text-zinc-200 shadow-md hover:scale-105 active:scale-95 transition"
            title="Rotate 90 degrees"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>

        {/* Mannequin / Avatar Container with 360° Rotation Transform */}
        <div
          className="relative w-full h-full max-w-sm flex items-center justify-center cursor-grab active:cursor-grabbing"
          style={{ perspective: 1200 }}
        >
          {/* Subtle Ground Pedestal Shadow */}
          <div className="absolute bottom-12 w-64 h-12 rounded-[50%] bg-black/10 dark:bg-black/40 blur-md pointer-events-none transform rotateX(60deg)" />

          <motion.div
            animate={{
              scale: zoomLevel,
              rotateY: isBackView ? 180 : 0,
            }}
            transition={{ type: "spring", stiffness: 140, damping: 20 }}
            className="relative h-[72vh] max-h-[580px] w-auto aspect-[9/18] flex items-center justify-center"
          >
            <img
              src={displayAvatarImage}
              alt={currentPreset.name}
              className="h-full w-auto object-contain pointer-events-none drop-shadow-xl"
            />
          </motion.div>

          {/* Floating Interactive Item Pins (Matches Screenshot) */}
          {/* 1. TOP GARMENT PIN */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            key={`pin-top-${currentPreset.id}`}
            onClick={(e) => {
              e.stopPropagation();
              setInspectingPiece(currentPreset.top);
            }}
            className="absolute top-[28%] left-[16%] sm:left-[22%] z-20 flex items-center gap-1.5 p-1.5 pr-2.5 rounded-full bg-white/85 dark:bg-zinc-850/90 backdrop-blur-md border border-black/10 dark:border-white/15 shadow-lg cursor-pointer hover:scale-105 transition"
          >
            <div className="w-8 h-8 rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800 border border-black/10 shrink-0">
              <img
                src={currentPreset.top.imageUrl}
                alt={currentPreset.top.name}
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-[11px] font-bold text-zinc-800 dark:text-zinc-100 font-mono">
              {formatPrice(currentPreset.top)}
            </span>
            <div className="w-4 h-4 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 grid place-items-center">
              <Plus className="w-2.5 h-2.5" />
            </div>
          </motion.div>

          {/* 2. BOTTOM SKIRT / PANTS PIN */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            key={`pin-btm-${currentPreset.id}`}
            onClick={(e) => {
              e.stopPropagation();
              setInspectingPiece(currentPreset.bottom);
            }}
            className="absolute top-[48%] right-[14%] sm:right-[20%] z-20 flex items-center gap-1.5 p-1.5 pr-2.5 rounded-full bg-white/85 dark:bg-zinc-850/90 backdrop-blur-md border border-black/10 dark:border-white/15 shadow-lg cursor-pointer hover:scale-105 transition"
          >
            <div className="w-8 h-8 rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800 border border-black/10 shrink-0">
              <img
                src={currentPreset.bottom.imageUrl}
                alt={currentPreset.bottom.name}
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-[11px] font-bold text-zinc-800 dark:text-zinc-100 font-mono">
              {formatPrice(currentPreset.bottom)}
            </span>
            <div className="w-4 h-4 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 grid place-items-center">
              <Plus className="w-2.5 h-2.5" />
            </div>
          </motion.div>

          {/* 3. SHOES / BOOTS PIN */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            key={`pin-shoes-${currentPreset.id}`}
            onClick={(e) => {
              e.stopPropagation();
              setInspectingPiece(currentPreset.shoes);
            }}
            className="absolute bottom-[20%] left-[22%] sm:left-[28%] z-20 flex items-center gap-1.5 p-1.5 pr-2.5 rounded-full bg-white/85 dark:bg-zinc-850/90 backdrop-blur-md border border-black/10 dark:border-white/15 shadow-lg cursor-pointer hover:scale-105 transition"
          >
            <div className="w-8 h-8 rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800 border border-black/10 shrink-0">
              <img
                src={currentPreset.shoes.imageUrl}
                alt={currentPreset.shoes.name}
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-[11px] font-bold text-zinc-800 dark:text-zinc-100 font-mono">
              {formatPrice(currentPreset.shoes)}
            </span>
            <div className="w-4 h-4 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 grid place-items-center">
              <Plus className="w-2.5 h-2.5" />
            </div>
          </motion.div>
        </div>

        {/* 360° Drag & Rotate Tooltip Hint */}
        <div className="absolute bottom-28 inset-x-0 flex justify-center pointer-events-none">
          <span className="px-3 py-1 rounded-full bg-black/40 backdrop-blur-md text-white text-[10px] font-semibold tracking-wide">
            ↔ Drag model to rotate 360° ({Math.round(rotationAngle)}°)
          </span>
        </div>
      </main>

      {/* Bottom Floating Style Presets Carousel (Matches Screenshot & Video) */}
      <footer className="relative z-30 pb-4 px-3 sm:px-6">
        <div className="mx-auto max-w-lg rounded-[32px] bg-white/85 dark:bg-zinc-900/90 backdrop-blur-xl border border-black/5 dark:border-white/10 p-3.5 shadow-2xl space-y-2">
          {/* Horizontal Preset Carousel */}
          <div className="flex items-center justify-start gap-4 overflow-x-auto no-scrollbar px-2 py-1">
            {OUTFIT_PRESETS.map((preset) => {
              const active = preset.id === currentPreset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handlePresetSelect(preset)}
                  className="flex flex-col items-center shrink-0 group focus:outline-none transition-transform active:scale-95"
                >
                  {/* Color Swatch Dots floating on top */}
                  <div className="flex items-center gap-1 mb-1.5 px-1.5 py-0.5 rounded-full bg-zinc-200/60 dark:bg-zinc-800/80 shadow-xs">
                    {preset.swatches.map((color, i) => (
                      <span
                        key={i}
                        className="w-2 h-2 rounded-full border border-black/10 dark:border-white/10 shadow-xs"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>

                  {/* Circular Outfit Thumbnail */}
                  <div
                    className={`relative w-14 h-14 rounded-full p-0.5 transition-all duration-300 ${
                      active
                        ? "ring-2 ring-rose-500 ring-offset-2 ring-offset-white dark:ring-offset-zinc-900 scale-105 shadow-md shadow-rose-500/30"
                        : "opacity-80 group-hover:opacity-100"
                    }`}
                  >
                    <div className="w-full h-full rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800 border border-black/5">
                      <img
                        src={preset.thumbnailUrl}
                        alt={preset.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>

                  {/* Preset Label */}
                  <span
                    className={`text-[10px] font-bold mt-1.5 text-center truncate max-w-[70px] ${
                      active
                        ? "text-zinc-900 dark:text-zinc-100"
                        : "text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-700"
                    }`}
                  >
                    {preset.name}
                  </span>
                </button>
              );
            })}
          </div>

          {/* "More looks like this >" Button (Matches Video & Screenshot) */}
          <div className="pt-1 flex justify-center">
            <button
              type="button"
              onClick={() => {
                void triggerLightHaptic();
                setShowDrawer(true);
              }}
              className="px-5 py-2 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-zinc-900 dark:text-zinc-100 text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
            >
              <span>More looks like this</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </footer>

      {/* "More Looks Like This" & Outfit Recipe Drawer */}
      <AnimatePresence>
        {showDrawer && (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center"
            onClick={() => setShowDrawer(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 240 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-t-[36px] border-t border-black/5 dark:border-white/10 p-6 space-y-4 max-h-[85vh] overflow-y-auto shadow-2xl text-foreground"
            >
              <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
                <div>
                  <h3 className="font-display font-bold text-lg text-zinc-900 dark:text-zinc-100">
                    {currentPreset.name} Styling Recipe
                  </h3>
                  <p className="text-xs text-muted-foreground">{currentPreset.occasion}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDrawer(false)}
                  className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Pieces Breakdown */}
              <div className="space-y-2.5">
                {[currentPreset.top, currentPreset.bottom, currentPreset.shoes].map((piece) => (
                  <div
                    key={piece.id}
                    onClick={() => setInspectingPiece(piece)}
                    className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3 cursor-pointer hover:border-rose-400 transition"
                  >
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-zinc-200 dark:bg-zinc-700 shrink-0">
                      <img src={piece.imageUrl} alt={piece.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] uppercase font-bold text-rose-500">
                        {piece.category}
                      </div>
                      <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                        {piece.name}
                      </div>
                      <div className="text-[11px] text-muted-foreground">{piece.brandOrStyle}</div>
                    </div>
                    <div className="text-xs font-bold font-mono text-zinc-900 dark:text-zinc-100 shrink-0">
                      {formatPrice(piece)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Styling Advice Card */}
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs space-y-1">
                <span className="font-bold text-rose-500 uppercase tracking-wide block">
                  Color Harmony Principle:
                </span>
                <p className="text-zinc-700 dark:text-zinc-200 leading-relaxed">
                  {currentPreset.stylingRule}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handlePostToFeed}
                  className="flex-1 py-3 px-4 rounded-2xl bg-snap text-snap-foreground font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:brightness-105 transition shadow-sm"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Post Fit to Flick Feed</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    void downloadMedia(currentPreset.angles.front, `flick-style-${currentPreset.id}.jpg`);
                    toast.success("Downloading styled look photo…");
                  }}
                  className="p-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 transition"
                  title="Download photo"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Piece Inspector Modal */}
      <AnimatePresence>
        {inspectingPiece && (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setInspectingPiece(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl border border-black/10 dark:border-white/10 p-5 shadow-2xl text-foreground space-y-4"
            >
              <div className="relative w-full h-48 rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                <img
                  src={inspectingPiece.imageUrl}
                  alt={inspectingPiece.name}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setInspectingPiece(null)}
                  className="absolute top-3 right-3 p-1.5 rounded-full bg-black/60 text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-500">
                  {inspectingPiece.category} piece
                </span>
                <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 mt-0.5">
                  {inspectingPiece.name}
                </h4>
                <p className="text-xs text-muted-foreground">{inspectingPiece.brandOrStyle}</p>
                <div className="mt-2 text-base font-bold font-mono text-zinc-900 dark:text-zinc-100">
                  {formatPrice(inspectingPiece)}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  toast.success(`Saved "${inspectingPiece.name}" to wishlist`);
                  setInspectingPiece(null);
                }}
                className="w-full py-3 rounded-2xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold text-xs uppercase tracking-wider transition hover:opacity-90"
              >
                Save Piece to Wishlist
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Avatar Model Picker Modal */}
      <AnimatePresence>
        {showAvatarPicker && (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowAvatarPicker(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl border border-black/10 dark:border-white/10 p-5 shadow-2xl text-foreground space-y-4"
            >
              <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
                <h3 className="font-display font-bold text-base text-zinc-900 dark:text-zinc-100">
                  Select Fitting Room Model
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAvatarPicker(false)}
                  className="p-1 rounded-full text-zinc-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {AVATAR_MODELS.map((model) => {
                  const selected = model.id === selectedAvatar.id;
                  return (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => {
                        void triggerLightHaptic();
                        setSelectedAvatar(model);
                        setShowAvatarPicker(false);
                        toast.success(`Switched model to ${model.name}`);
                      }}
                      className={`p-3 rounded-2xl border text-left transition flex flex-col items-center gap-2 ${
                        selected
                          ? "bg-rose-500/10 border-rose-500 text-rose-500 ring-2 ring-rose-500/20"
                          : "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100"
                      }`}
                    >
                      <div className="w-14 h-14 rounded-2xl overflow-hidden border border-black/10 shadow-xs">
                        <img
                          src={model.avatarThumb}
                          alt={model.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span className="font-bold text-xs">{model.name}</span>
                      <span className="text-[10px] text-muted-foreground text-center line-clamp-1">
                        {model.gender === "female" ? "Female Fit" : "Male Fit"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
