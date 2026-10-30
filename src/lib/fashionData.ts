export type GarmentCategory = "top" | "bottom" | "dress" | "shoes" | "accessory";

export type FashionAesthetic =
  | "Streetwear"
  | "Old Money"
  | "Minimalist"
  | "Casual"
  | "Formal"
  | "Y2K"
  | "Athleisure"
  | "Traditional & African"
  | "Date Night"
  | "Campus Fits";

export interface GarmentColor {
  name: string;
  hex: string;
}

export interface GarmentItem {
  id: string;
  category: GarmentCategory;
  name: string;
  brand: string;
  aesthetic: FashionAesthetic[];
  style?: FashionAesthetic | string;
  priceUSD: number;
  priceCNY: number;
  priceNGN: number;
  imageUrl: string;
  thumbnailUrl: string;
  transparentUrl?: string; // Transparent PNG layer when applicable
  colors: GarmentColor[];
  availableColors: GarmentColor[];
  sizes: string[];
  availableSizes: string[];
  materials: string;
  description: string;
  inStock: boolean;
  stockCount: number;
  rating: number;
}

export interface FashionModel {
  id: string;
  name: string;
  gender: "female" | "male";
  avatarThumb: string;
  bio: string;
  defaultAngles: {
    front: string;
    side: string;
    back: string;
  };
  baseImages: {
    front: string;
    side: string;
    back: string;
  };
}

export type ModelAvatar = FashionModel;

export interface CurrentOutfit {
  top?: GarmentItem;
  bottom?: GarmentItem;
  dress?: GarmentItem;
  shoes?: GarmentItem;
  accessory?: GarmentItem;
}

export type FashionStyle =
  | "Streetwear"
  | "Old Money"
  | "Minimalist"
  | "Casual"
  | "Formal"
  | "Y2K"
  | "Athleisure"
  | "African Traditional"
  | "Traditional & African"
  | "Date Night"
  | "Campus Fits";

export interface FashionHairstyle {
  id: string;
  name: string;
  icon: string;
  description?: string;
}

export const FASHION_HAIRSTYLES: FashionHairstyle[] = [
  { id: "natural", name: "Natural Flow", icon: "✨", description: "Default natural cut" },
  { id: "braids", name: "Box Braids", icon: "👑", description: "Intricate sleek protective braids" },
  { id: "bob", name: "Sleek Blunt Bob", icon: "✂️", description: "Clean sharp modern aesthetic" },
  { id: "fade", name: "Low Taper Fade", icon: "⚡", description: "Crisp line-up and textured top" },
  { id: "curls", name: "Voluminous Curls", icon: "🌀", description: "Bouncy soft textured spirals" },
  { id: "updo", name: "Messy High Bun", icon: "🎀", description: "Effortless casual chic updo" },
  { id: "buzz", name: "Pastel Buzz Cut", icon: "💫", description: "Avant-garde editorial statement" },
];

export interface CuratedLook {
  id: string;
  name: string;
  title?: string;
  aesthetic: FashionAesthetic;
  styleCategory?: FashionStyle | string;
  occasion?: string;
  swatches: string[];
  thumbnailUrl: string;
  angles: {
    front: string;
    side: string;
    back: string;
  };
  top?: GarmentItem;
  bottom?: GarmentItem;
  dress?: GarmentItem;
  shoes: GarmentItem;
  accessory?: GarmentItem;
  topId?: string;
  bottomId?: string;
  dressId?: string;
  shoesId?: string;
  accessoryId?: string;
  stylingRule: string;
  likes: number;
  modelId: string;
  tags?: string[];
}

export interface SavedOutfit {
  id: string;
  userId: string;
  name: string;
  description?: string;
  collection: "All" | "Work" | "Campus" | "Weekend" | "Events" | "Date Night" | "Cultural" | string;
  isFavorite: boolean;
  modelId: string;
  previewImage?: string;
  previewUrl?: string;
  stylingRule?: string;
  items: {
    top?: GarmentItem;
    bottom?: GarmentItem;
    dress?: GarmentItem;
    shoes?: GarmentItem;
    accessory?: GarmentItem;
    topId?: string;
    bottomId?: string;
    dressId?: string;
    shoesId?: string;
    accessoryId?: string;
  };
  createdAt: string;
  updatedAt: string;
}

// ----------------------------------------------------
// MODELS
// ----------------------------------------------------
export const FASHION_MODELS: FashionModel[] = [
  {
    id: "mei",
    name: "Mei",
    gender: "female",
    avatarThumb: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80",
    bio: "College sophomore • Acubi, Streetwear & Y2K aesthetics",
    defaultAngles: {
      front: "/assets/aistudio/download__38__1d85c90f.jpg",
      side: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=85",
      back: "/assets/aistudio/download__38__1d85c90f.jpg",
    },
    baseImages: {
      front: "/assets/aistudio/download__38__1d85c90f.jpg",
      side: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=85",
      back: "/assets/aistudio/download__38__1d85c90f.jpg",
    },
  },
  {
    id: "amara",
    name: "Amara",
    gender: "female",
    avatarThumb: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&auto=format&fit=crop&q=80",
    bio: "Fashion design lead • Lagos Afro-chic & modern traditionalist",
    defaultAngles: {
      front: "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=800&q=85",
      side: "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=800&q=85",
      back: "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=800&q=85",
    },
    baseImages: {
      front: "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=800&q=85",
      side: "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=800&q=85",
      back: "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=800&q=85",
    },
  },
  {
    id: "kai",
    name: "Kai",
    gender: "male",
    avatarThumb: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80",
    bio: "Senior architect • Old money tailoring & clean minimalism",
    defaultAngles: {
      front: "https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?auto=format&fit=crop&w=800&q=85",
      side: "https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?auto=format&fit=crop&w=800&q=85",
      back: "https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?auto=format&fit=crop&w=800&q=85",
    },
    baseImages: {
      front: "https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?auto=format&fit=crop&w=800&q=85",
      side: "https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?auto=format&fit=crop&w=800&q=85",
      back: "https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?auto=format&fit=crop&w=800&q=85",
    },
  },
  {
    id: "zara",
    name: "Zara",
    gender: "female",
    avatarThumb: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop&q=80",
    bio: "Editorial stylist • Parisian vintage knitwear & modern formal",
    defaultAngles: {
      front: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=85",
      side: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=85",
      back: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=85",
    },
    baseImages: {
      front: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=85",
      side: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=85",
      back: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=85",
    },
  },
  {
    id: "leo",
    name: "Leo",
    gender: "male",
    avatarThumb: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80",
    bio: "Track captain • Heavyweight athleisure & vintage varsity",
    defaultAngles: {
      front: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=85",
      side: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=85",
      back: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=85",
    },
    baseImages: {
      front: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=85",
      side: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=85",
      back: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=85",
    },
  },
];

// ----------------------------------------------------
// GARMENTS RAW DATA
// ----------------------------------------------------
const RAW_GARMENTS: (Omit<GarmentItem, "thumbnailUrl" | "availableColors" | "availableSizes"> & {
  thumbnailUrl?: string;
  availableColors?: GarmentColor[];
  availableSizes?: string[];
})[] = [
  // TOPS
  {
    id: "top-acubi",
    category: "top",
    name: "Oversized Cable Tie-Back Cardigan",
    brand: "Maison Acubi",
    aesthetic: ["Streetwear", "Campus Fits", "Y2K"],
    priceUSD: 32,
    priceCNY: 220,
    priceNGN: 48000,
    imageUrl: "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400&auto=format&fit=crop&q=80",
    colors: [
      { name: "Almond Butter", hex: "#D4B996" },
      { name: "Charcoal Slate", hex: "#3A3D40" },
      { name: "Oat Cream", hex: "#F3EDE2" },
    ],
    sizes: ["XS", "S", "M", "L"],
    materials: "100% Recycled Chunky Merino Wool Blend",
    description: "Slouchy cropped cardigan featuring signature open-back tie details and drop-shoulder cable knit.",
    inStock: true,
    stockCount: 14,
    rating: 4.9,
  },
  {
    id: "top-kpop",
    category: "top",
    name: "Crop Utility Windbreaker with Neon Panels",
    brand: "NeoSeoul Lab",
    aesthetic: ["Y2K", "Streetwear", "Athleisure"],
    priceUSD: 48,
    priceCNY: 340,
    priceNGN: 72000,
    imageUrl: "https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?w=400&auto=format&fit=crop&q=80",
    colors: [
      { name: "Solar Orange", hex: "#FF8C00" },
      { name: "Cyber Pitch", hex: "#111111" },
      { name: "Pure Chalk", hex: "#F5F5F5" },
    ],
    sizes: ["S", "M", "L", "XL"],
    materials: "Water-resistant matte nylon ripstop with breathable mesh vents",
    description: "High-energy cropped windbreaker featuring technical bungee toggles and reflective chest accents.",
    inStock: true,
    stockCount: 8,
    rating: 4.8,
  },
  {
    id: "top-street",
    category: "top",
    name: "Boxy Heavyweight Drop-Shoulder Tee",
    brand: "STUDIO 99",
    aesthetic: ["Streetwear", "Casual", "Campus Fits", "Minimalist"],
    priceUSD: 28,
    priceCNY: 198,
    priceNGN: 42000,
    imageUrl: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=400&auto=format&fit=crop&q=80",
    colors: [
      { name: "Vintage Ecru", hex: "#EAE6DF" },
      { name: "Washed Black", hex: "#222224" },
      { name: "Faded Sage", hex: "#8A9A86" },
    ],
    sizes: ["S", "M", "L", "XL", "XXL"],
    materials: "300gsm Organic Combed French Terry Cotton",
    description: "Architectural boxy drape with reinforced double-stitched crew neck and seamless dropped shoulders.",
    inStock: true,
    stockCount: 22,
    rating: 4.9,
  },
  {
    id: "top-blazer",
    category: "top",
    name: "Unstructured Oversized Slate Blazer",
    brand: "Atelier Savile",
    aesthetic: ["Old Money", "Formal", "Minimalist", "Date Night"],
    priceUSD: 85,
    priceCNY: 590,
    priceNGN: 125000,
    imageUrl: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400&auto=format&fit=crop&q=80",
    colors: [
      { name: "Slate Charcoal", hex: "#323639" },
      { name: "Deep Camel", hex: "#B8860B" },
      { name: "Midnight Navy", hex: "#1A2530" },
    ],
    sizes: ["XS", "S", "M", "L"],
    materials: "Virgin Italian Wool blend with satin viscose half-lining",
    description: "Tailored masculine cut with natural horn buttons and relaxed drape for fluid, effortless layering.",
    inStock: true,
    stockCount: 5,
    rating: 5.0,
  },
  {
    id: "top-senator",
    category: "top",
    name: "Geometric Embroidered Senator Tunic",
    brand: "Afronaut Couture",
    aesthetic: ["Traditional & African", "Formal", "Date Night"],
    priceUSD: 72,
    priceCNY: 510,
    priceNGN: 105000,
    imageUrl: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=400&auto=format&fit=crop&q=80",
    colors: [
      { name: "Indigo Sapphire", hex: "#1B365D" },
      { name: "Terracotta Earth", hex: "#C86446" },
      { name: "Pure White", hex: "#FFFFFF" },
    ],
    sizes: ["M", "L", "XL", "XXL"],
    materials: "Premium Polish Cashmere Cotton with Hand-threaded Gold Filigree",
    description: "Contemporary West African high-neck tunic adorned with minimal geometric chest embroidery.",
    inStock: true,
    stockCount: 9,
    rating: 5.0,
  },
  {
    id: "top-cyber",
    category: "top",
    name: "Technical Utility Vest with Chrome Clasps",
    brand: "CyberSystem",
    aesthetic: ["Y2K", "Streetwear", "Athleisure"],
    priceUSD: 60,
    priceCNY: 430,
    priceNGN: 90000,
    imageUrl: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400&auto=format&fit=crop&q=80",
    colors: [
      { name: "Matte Stealth", hex: "#18181A" },
      { name: "Military Olive", hex: "#4A5320" },
    ],
    sizes: ["S", "M", "L"],
    materials: "Cordura 500D Ballistic Canvas with Quick-Release Cobra Clasps",
    description: "Modular chest rig designed for streetwear layering and techwear silhouettes.",
    inStock: true,
    stockCount: 11,
    rating: 4.7,
  },

  // BOTTOMS
  {
    id: "btm-acubi",
    category: "bottom",
    name: "High-Waist Tiered Linen Skort",
    brand: "Maison Acubi",
    aesthetic: ["Streetwear", "Y2K", "Campus Fits"],
    priceUSD: 40,
    priceCNY: 280,
    priceNGN: 60000,
    imageUrl: "https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=400&auto=format&fit=crop&q=80",
    colors: [
      { name: "Warm Khaki", hex: "#C3B091" },
      { name: "Noir", hex: "#1E1E1E" },
      { name: "Milk Cream", hex: "#FFFDD0" },
    ],
    sizes: ["XS", "S", "M", "L"],
    materials: "Natural Washed French Flax Linen",
    description: "Asymmetrical micro-tiered skort featuring hidden active-stretch inner shorts.",
    inStock: true,
    stockCount: 18,
    rating: 4.8,
  },
  {
    id: "btm-kpop",
    category: "bottom",
    name: "Buckle Cargo Mini Shorts",
    brand: "NeoSeoul Lab",
    aesthetic: ["Y2K", "Streetwear", "Athleisure"],
    priceUSD: 36,
    priceCNY: 260,
    priceNGN: 54000,
    imageUrl: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=400&auto=format&fit=crop&q=80",
    colors: [
      { name: "Deep Obsidian", hex: "#121214" },
      { name: "Desert Sand", hex: "#D2B48C" },
    ],
    sizes: ["S", "M", "L"],
    materials: "Stretch Cotton Twill with Nylon Webbing Straps",
    description: "High-energy stage shorts with dual bellows pockets and anodized metal D-rings.",
    inStock: true,
    stockCount: 12,
    rating: 4.7,
  },
  {
    id: "btm-street",
    category: "bottom",
    name: "Relaxed Carpenter Raw Denim",
    brand: "STUDIO 99",
    aesthetic: ["Streetwear", "Casual", "Campus Fits", "Minimalist"],
    priceUSD: 55,
    priceCNY: 390,
    priceNGN: 82000,
    imageUrl: "https://images.unsplash.com/photo-1542272604-780c96856592?w=400&auto=format&fit=crop&q=80",
    colors: [
      { name: "Indigo Vintage", hex: "#2B3A4A" },
      { name: "Faded Bone", hex: "#E3DCCB" },
      { name: "Washed Graphite", hex: "#383B3E" },
    ],
    sizes: ["28", "30", "32", "34", "36"],
    materials: "14oz Selvedge 100% Japanese Cotton Denim",
    description: "Wide-straight utilitarian denim with authentic hammer loop and reinforced knee panels.",
    inStock: true,
    stockCount: 15,
    rating: 4.9,
  },
  {
    id: "btm-pres",
    category: "bottom",
    name: "Wide-Leg Double Pleated Trousers",
    brand: "Atelier Savile",
    aesthetic: ["Old Money", "Formal", "Minimalist"],
    priceUSD: 52,
    priceCNY: 370,
    priceNGN: 78000,
    imageUrl: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=400&auto=format&fit=crop&q=80",
    colors: [
      { name: "Flannel Grey", hex: "#4B5056" },
      { name: "Dark Walnut", hex: "#3B2F2F" },
      { name: "Ecru Wool", hex: "#EDE8DD" },
    ],
    sizes: ["XS", "S", "M", "L", "XL"],
    materials: "Heavy Drape Wool-Poly blend with crease-resistant weave",
    description: "Classic high-rise trousers with sharp deep front pleats and fluid puddle break at the hem.",
    inStock: true,
    stockCount: 7,
    rating: 5.0,
  },
  {
    id: "btm-senator",
    category: "bottom",
    name: "Crisp Tapered Linen Senator Trousers",
    brand: "Afronaut Couture",
    aesthetic: ["Traditional & African", "Formal", "Old Money"],
    priceUSD: 45,
    priceCNY: 320,
    priceNGN: 68000,
    imageUrl: "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=400&auto=format&fit=crop&q=80",
    colors: [
      { name: "Pure Chalk", hex: "#FAFAFA" },
      { name: "Royal Midnight", hex: "#152238" },
      { name: "Desert Sand", hex: "#C2B280" },
    ],
    sizes: ["30", "32", "34", "36"],
    materials: "Tailored Egyptian Linen-Cotton Blend",
    description: "Sharp ankle-length tapered pants with concealed side elastic expanders for all-day comfort.",
    inStock: true,
    stockCount: 10,
    rating: 4.9,
  },

  // DRESSES & COORDINATED ONE-PIECES
  {
    id: "dress-slip",
    category: "dress",
    name: "Liquid Silk Bias-Cut Slip Dress",
    brand: "Maison Vesper",
    aesthetic: ["Date Night", "Minimalist", "Old Money", "Formal"],
    priceUSD: 95,
    priceCNY: 670,
    priceNGN: 145000,
    imageUrl: "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=400&auto=format&fit=crop&q=80",
    colors: [
      { name: "Champagne Pearl", hex: "#F7E7CE" },
      { name: "Emerald Glaze", hex: "#046307" },
      { name: "Caviar Black", hex: "#0D0D0D" },
    ],
    sizes: ["XS", "S", "M", "L"],
    materials: "100% Mulberry Silk Charmeuse 22 Momme",
    description: "Draped cowl neckline with delicate adjustable spaghetti straps and fluid ankle grazing hem.",
    inStock: true,
    stockCount: 6,
    rating: 5.0,
  },
  {
    id: "dress-ankara",
    category: "dress",
    name: "Sculptural Ankara Mermaid Midi",
    brand: "Afronaut Couture",
    aesthetic: ["Traditional & African", "Date Night", "Events" as any],
    priceUSD: 110,
    priceCNY: 780,
    priceNGN: 168000,
    imageUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80",
    colors: [
      { name: "Gold Sunset Ankara", hex: "#E5A93C" },
      { name: "Oceanic Turquoise", hex: "#30D5C8" },
    ],
    sizes: ["S", "M", "L", "XL"],
    materials: "Waxed Hollandais 100% Cotton with structured boning",
    description: "Statement off-shoulder silhouette with bold African geometric print and fluted mermaid hem.",
    inStock: true,
    stockCount: 4,
    rating: 5.0,
  },
  {
    id: "dress-tennis",
    category: "dress",
    name: "Pleated Court Performance Dress",
    brand: "Clubhouse Athletic",
    aesthetic: ["Athleisure", "Campus Fits", "Casual"],
    priceUSD: 45,
    priceCNY: 320,
    priceNGN: 68000,
    imageUrl: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&auto=format&fit=crop&q=80",
    colors: [
      { name: "Court White", hex: "#FFFFFF" },
      { name: "Forest Green", hex: "#228B22" },
      { name: "Pastel Lavender", hex: "#E6E6FA" },
    ],
    sizes: ["XS", "S", "M", "L"],
    materials: "Moisture-wicking micro-poly with built-in undershorts & ball pocket",
    description: "Vintage country club tennis dress with crisp knife-pleated skirt and polo collar.",
    inStock: true,
    stockCount: 16,
    rating: 4.8,
  },

  // SHOES
  {
    id: "shoe-acubi",
    category: "shoes",
    name: "Chunky Platform Suede Lug Boots",
    brand: "Maison Acubi",
    aesthetic: ["Streetwear", "Y2K", "Campus Fits"],
    priceUSD: 65,
    priceCNY: 460,
    priceNGN: 98000,
    imageUrl: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=400&auto=format&fit=crop&q=80",
    colors: [
      { name: "Sand Suede", hex: "#C2B280" },
      { name: "Pitch Black", hex: "#1A1A1A" },
    ],
    sizes: ["36", "37", "38", "39", "40", "41"],
    materials: "Water-repellent genuine cow suede with 6cm ultra-light EVA platform",
    description: "Statement platform boots with thick tonal stitching and slip-resistant sawtooth rubber treads.",
    inStock: true,
    stockCount: 11,
    rating: 4.9,
  },
  {
    id: "shoe-kpop",
    category: "shoes",
    name: "White Chunky High-Top Trainers",
    brand: "NeoSeoul Lab",
    aesthetic: ["Y2K", "Streetwear", "Athleisure"],
    priceUSD: 85,
    priceCNY: 590,
    priceNGN: 125000,
    imageUrl: "https://images.unsplash.com/photo-1552346154-21d32810aba3?w=400&auto=format&fit=crop&q=80",
    colors: [
      { name: "Triple White", hex: "#FFFFFF" },
      { name: "Neon Volt", hex: "#CEFF00" },
    ],
    sizes: ["38", "39", "40", "41", "42", "43", "44"],
    materials: "Full-grain calfskin with breathable foam collar & air-cushion midsole",
    description: "Futuristic silhouette with layered geometric panels and oversized architectural soles.",
    inStock: true,
    stockCount: 9,
    rating: 4.8,
  },
  {
    id: "shoe-street",
    category: "shoes",
    name: "Retro Gum-Sole Court Lows",
    brand: "STUDIO 99",
    aesthetic: ["Streetwear", "Casual", "Campus Fits", "Old Money"],
    priceUSD: 70,
    priceCNY: 490,
    priceNGN: 105000,
    imageUrl: "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=400&auto=format&fit=crop&q=80",
    colors: [
      { name: "Chalk / Gum", hex: "#F4F0EA" },
      { name: "Vintage Navy", hex: "#1C2833" },
      { name: "Forest Suede", hex: "#2E4033" },
    ],
    sizes: ["37", "38", "39", "40", "41", "42", "43", "45"],
    materials: "Soft tumbled nappa leather with natural vulcanized gum sole",
    description: "Iconic 70s heritage low-top sneaker featuring slim profile and suede T-toe overlay.",
    inStock: true,
    stockCount: 25,
    rating: 5.0,
  },
  {
    id: "shoe-pres",
    category: "shoes",
    name: "Polished Black Leather Penny Loafers",
    brand: "Atelier Savile",
    aesthetic: ["Old Money", "Formal", "Minimalist", "Date Night"],
    priceUSD: 95,
    priceCNY: 670,
    priceNGN: 142000,
    imageUrl: "https://images.unsplash.com/photo-1614252369475-531eba835eb1?w=400&auto=format&fit=crop&q=80",
    colors: [
      { name: "Onyx Polish", hex: "#0E0E10" },
      { name: "Burnished Oxblood", hex: "#4A1521" },
    ],
    sizes: ["39", "40", "41", "42", "43", "44"],
    materials: "Box calf leather with Goodyear welted leather sole and stacked heel",
    description: "Timeless handcrafted penny loafer featuring hand-stitched apron and brass coin slot.",
    inStock: true,
    stockCount: 7,
    rating: 5.0,
  },
  {
    id: "shoe-senator",
    category: "shoes",
    name: "Handcrafted Burnished Leather Mules",
    brand: "Afronaut Couture",
    aesthetic: ["Traditional & African", "Formal", "Old Money"],
    priceUSD: 78,
    priceCNY: 550,
    priceNGN: 115000,
    imageUrl: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=400&auto=format&fit=crop&q=80",
    colors: [
      { name: "Espresso Brown", hex: "#3D2B1F" },
      { name: "Cognac Tan", hex: "#8B5A2B" },
    ],
    sizes: ["40", "41", "42", "43", "44", "45"],
    materials: "Full grain vegetable-tanned leather with cushioned arch support",
    description: "Sleek slip-on mules designed specifically to accompany traditional tunics and formal trousers.",
    inStock: true,
    stockCount: 8,
    rating: 4.9,
  },
  {
    id: "shoe-heels",
    category: "shoes",
    name: "Minimalist Strappy 75mm Heeled Sandals",
    brand: "Maison Vesper",
    aesthetic: ["Date Night", "Formal", "Old Money"],
    priceUSD: 88,
    priceCNY: 620,
    priceNGN: 132000,
    imageUrl: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=400&auto=format&fit=crop&q=80",
    colors: [
      { name: "Metallic Gold", hex: "#D4AF37" },
      { name: "Nude Blush", hex: "#DEB887" },
      { name: "Black Velvet", hex: "#111111" },
    ],
    sizes: ["36", "37", "38", "39", "40"],
    materials: "Italian nappa leather straps with cushioned insole and sculpted kitten stiletto",
    description: "Barely-there delicate strap sandals that elongate the legs without compromising evening comfort.",
    inStock: true,
    stockCount: 5,
    rating: 4.8,
  },

  // ACCESSORIES
  {
    id: "acc-bag",
    category: "accessory",
    name: "Baguette Crossbody in Smooth Nappa",
    brand: "Maison Vesper",
    aesthetic: ["Y2K", "Date Night", "Streetwear", "Old Money"],
    priceUSD: 42,
    priceCNY: 295,
    priceNGN: 64000,
    imageUrl: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400&auto=format&fit=crop&q=80",
    colors: [
      { name: "Butter Cream", hex: "#FDF5E6" },
      { name: "Midnight Noir", hex: "#111111" },
      { name: "Olive Glaze", hex: "#556B2F" },
    ],
    sizes: ["One Size"],
    materials: "Cruelty-free vegan leather with brushed chrome magnetic hardware",
    description: "Compact 90s shoulder silhouette with convertible crossbody strap and interior card organizer.",
    inStock: true,
    stockCount: 14,
    rating: 4.9,
  },
  {
    id: "acc-shades",
    category: "accessory",
    name: "Rimless Cyber Matrix Sunglasses",
    brand: "NeoSeoul Lab",
    aesthetic: ["Y2K", "Streetwear", "Minimalist"],
    priceUSD: 24,
    priceCNY: 170,
    priceNGN: 36000,
    imageUrl: "https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=400&auto=format&fit=crop&q=80",
    colors: [
      { name: "Silver Flash", hex: "#C0C0C0" },
      { name: "Gradient Bronze", hex: "#8C7853" },
    ],
    sizes: ["One Size"],
    materials: "Impact-resistant polycarbonate UV400 lenses with titanium temples",
    description: "Ultra-slim aerodynamic rimless frame for maximum futuristic edge.",
    inStock: true,
    stockCount: 20,
    rating: 4.8,
  },
  {
    id: "acc-beads",
    category: "accessory",
    name: "Hand-Carved Coral Bead Wristlet & Neck Cuff",
    brand: "Afronaut Couture",
    aesthetic: ["Traditional & African", "Events" as any],
    priceUSD: 35,
    priceCNY: 250,
    priceNGN: 52000,
    imageUrl: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=400&auto=format&fit=crop&q=80",
    colors: [
      { name: "Royal Coral Red", hex: "#FF4040" },
      { name: "Edo Terracotta", hex: "#E2725B" },
    ],
    sizes: ["Adjustable"],
    materials: "Natural polished red coral cylinders strung on braided nylon thread",
    description: "Signature Nigerian ceremonial coral beads handcrafted for formal and cultural occasions.",
    inStock: true,
    stockCount: 8,
    rating: 5.0,
  },
  {
    id: "acc-cap",
    category: "accessory",
    name: "Vintage Washed Cotton Dad Cap",
    brand: "STUDIO 99",
    aesthetic: ["Streetwear", "Campus Fits", "Casual", "Athleisure"],
    priceUSD: 22,
    priceCNY: 155,
    priceNGN: 33000,
    imageUrl: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=400&auto=format&fit=crop&q=80",
    colors: [
      { name: "Washed Navy", hex: "#2C3E50" },
      { name: "Forest Moss", hex: "#354F52" },
      { name: "Clay Stone", hex: "#D8C4B6" },
    ],
    sizes: ["One Size (Strapback)"],
    materials: "100% garment-dyed chino twill with brass buckle closure",
    description: "Unstructured 6-panel low profile cap with subtly pre-curved visor.",
    inStock: true,
    stockCount: 30,
    rating: 4.9,
  },
];

// ----------------------------------------------------
// GARMENTS CATALOG (NORMALIZED WITH ALIASES)
// ----------------------------------------------------
export const GARMENTS_CATALOG: GarmentItem[] = RAW_GARMENTS.map((g) => ({
  ...g,
  thumbnailUrl: g.thumbnailUrl || g.imageUrl,
  availableColors: g.availableColors || g.colors,
  availableSizes: g.availableSizes || g.sizes,
  style: g.style || g.aesthetic[0],
}));

// ----------------------------------------------------
// CURATED LOOKS (FOR STYLE DISCOVERY)
// ----------------------------------------------------
export const CURATED_LOOKS: CuratedLook[] = [
  {
    id: "look_acubi_fairy",
    name: "Acubi Fairy",
    aesthetic: "Streetwear",
    occasion: "Campus & Creative Studio",
    swatches: ["#D4B996", "#8C6D53"],
    thumbnailUrl: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=300&q=80",
    angles: {
      front: "/assets/aistudio/download__38__1d85c90f.jpg",
      side: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=85",
      back: "/assets/aistudio/download__38__1d85c90f.jpg",
    },
    top: GARMENTS_CATALOG.find((g) => g.id === "top-acubi"),
    bottom: GARMENTS_CATALOG.find((g) => g.id === "btm-acubi"),
    shoes: GARMENTS_CATALOG.find((g) => g.id === "shoe-acubi")!,
    accessory: GARMENTS_CATALOG.find((g) => g.id === "acc-bag"),
    stylingRule: "Tonal Earth Harmony: Warm camel and sand knitwear balanced with stacked socks and lug-sole boots.",
    likes: 842,
    modelId: "mei",
    tags: ["Acubi", "Subtle Street", "Tonal Neutral"],
  },
  {
    id: "look_kpop_stage",
    name: "K-Pop Stage Idol",
    aesthetic: "Y2K",
    occasion: "Performance & Friday Party",
    swatches: ["#FF8C00", "#1A1A1A", "#FFFFFF"],
    thumbnailUrl: "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=300&q=80",
    angles: {
      front: "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=800&q=85",
      side: "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=800&q=85",
      back: "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=800&q=85",
    },
    top: GARMENTS_CATALOG.find((g) => g.id === "top-kpop"),
    bottom: GARMENTS_CATALOG.find((g) => g.id === "btm-kpop"),
    shoes: GARMENTS_CATALOG.find((g) => g.id === "shoe-kpop")!,
    accessory: GARMENTS_CATALOG.find((g) => g.id === "acc-shades"),
    stylingRule: "High-Contrast Statement: Let the vivid orange accent pop against monochromatic black straps.",
    likes: 1240,
    modelId: "mei",
    tags: ["Stage Tech", "Neon Accent", "Y2K Cargo"],
  },
  {
    id: "look_old_money_blazer",
    name: "Riviera Old Money",
    aesthetic: "Old Money",
    occasion: "Sunday Brunch & Gallery Opening",
    swatches: ["#323639", "#4B5056", "#0E0E10"],
    thumbnailUrl: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=300&q=80",
    angles: {
      front: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=800&q=85",
      side: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=800&q=85",
      back: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=800&q=85",
    },
    top: GARMENTS_CATALOG.find((g) => g.id === "top-blazer"),
    bottom: GARMENTS_CATALOG.find((g) => g.id === "btm-pres"),
    shoes: GARMENTS_CATALOG.find((g) => g.id === "shoe-pres")!,
    accessory: GARMENTS_CATALOG.find((g) => g.id === "acc-bag"),
    stylingRule: "The High-Low Balance: Structured formal upper paired with relaxed, modern wide trousers and polished loafers.",
    likes: 1180,
    modelId: "kai",
    tags: ["Savile Row", "Double Pleat", "Tailored"],
  },
  {
    id: "look_naija_heritage",
    name: "Naija Heritage Senator",
    aesthetic: "Traditional & African",
    occasion: "Traditional Wedding & Cultural Gala",
    swatches: ["#1B365D", "#FFFFFF", "#FF4040"],
    thumbnailUrl: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=300&q=80",
    angles: {
      front: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=85",
      side: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=85",
      back: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=85",
    },
    top: GARMENTS_CATALOG.find((g) => g.id === "top-senator"),
    bottom: GARMENTS_CATALOG.find((g) => g.id === "btm-senator"),
    shoes: GARMENTS_CATALOG.find((g) => g.id === "shoe-senator")!,
    accessory: GARMENTS_CATALOG.find((g) => g.id === "acc-beads"),
    stylingRule: "Focal Contrast Rule: Rich deep navy tunic embroidery paired with crisp white pants and coral wrist beads.",
    likes: 1490,
    modelId: "amara",
    tags: ["Afro Chic", "Lagos Senator", "Coral Beads"],
  },
  {
    id: "look_clean_campus",
    name: "Clean Campus Everyday",
    aesthetic: "Campus Fits",
    occasion: "Campus Lecture & Library Study",
    swatches: ["#EAE6DF", "#2B3A4A", "#F4F0EA"],
    thumbnailUrl: "https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?auto=format&fit=crop&w=300&q=80",
    angles: {
      front: "https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?auto=format&fit=crop&w=800&q=85",
      side: "https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?auto=format&fit=crop&w=800&q=85",
      back: "https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?auto=format&fit=crop&w=800&q=85",
    },
    top: GARMENTS_CATALOG.find((g) => g.id === "top-street"),
    bottom: GARMENTS_CATALOG.find((g) => g.id === "btm-street"),
    shoes: GARMENTS_CATALOG.find((g) => g.id === "shoe-street")!,
    accessory: GARMENTS_CATALOG.find((g) => g.id === "acc-cap"),
    stylingRule: "The Sandwich Rule: Balance the upper white silhouette with clean white/gum-sole footwear below.",
    likes: 980,
    modelId: "kai",
    tags: ["Campus Core", "Raw Denim", "Samba Kicks"],
  },
  {
    id: "look_silk_datenight",
    name: "Silk Date Night Glam",
    aesthetic: "Date Night",
    occasion: "Rooftop Cocktails & Intimate Dinner",
    swatches: ["#F7E7CE", "#D4AF37", "#111111"],
    thumbnailUrl: "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=300&q=80",
    angles: {
      front: "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=800&q=85",
      side: "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=800&q=85",
      back: "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=800&q=85",
    },
    dress: GARMENTS_CATALOG.find((g) => g.id === "dress-slip"),
    shoes: GARMENTS_CATALOG.find((g) => g.id === "shoe-heels")!,
    accessory: GARMENTS_CATALOG.find((g) => g.id === "acc-bag"),
    stylingRule: "Monochrome Fluidity: Pure silk drape complemented by champagne heeled straps and minimalist baguette clutch.",
    likes: 1310,
    modelId: "zara",
    tags: ["Mulberry Silk", "Slip Dress", "Barely There"],
  },
  {
    id: "look_court_athleisure",
    name: "Clubhouse Athleisure",
    aesthetic: "Athleisure",
    occasion: "Morning Padel & Weekend Cafe",
    swatches: ["#FFFFFF", "#228B22", "#F4F0EA"],
    thumbnailUrl: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=300&q=80",
    angles: {
      front: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=85",
      side: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=85",
      back: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=85",
    },
    dress: GARMENTS_CATALOG.find((g) => g.id === "dress-tennis"),
    shoes: GARMENTS_CATALOG.find((g) => g.id === "shoe-street")!,
    accessory: GARMENTS_CATALOG.find((g) => g.id === "acc-cap"),
    stylingRule: "Clean Preppy Silhouette: Knife-pleated court dress styled effortlessly with dad cap and vintage low-tops.",
    likes: 920,
    modelId: "mei",
    tags: ["Tennis Core", "Preppy Clean", "Court Dress"],
  },
];

// Helper to look up garment safely with fallback
const findPiece = (id: string): GarmentItem => {
  return GARMENTS_CATALOG.find((g) => g.id === id) || GARMENTS_CATALOG[0];
};

// Export aliases for compatibility across Studio, Picker, Modals, and AI Stylist
export const GARMENT_CATALOG: GarmentItem[] = [
  ...GARMENTS_CATALOG,
  // Add common aliases so searches by ID in Fashion.tsx or AI stylist never fail
  {
    ...findPiece("top-acubi"),
    id: "top-acubi-cardigan",
    name: "Acubi Tie-Back Knit Cardigan",
  },
  {
    ...findPiece("btm-acubi"),
    id: "btm-acubi-skort",
    name: "Acubi Pleated Low-Rise Skort",
  },
  {
    ...findPiece("shoe-acubi"),
    id: "shoe-platform-boots",
    name: "Chunky Platform Lug-Sole Boots",
  },
  {
    ...findPiece("acc-bag"),
    id: "acc-canvas-tote",
    name: "Minimalist Canvas Everyday Tote",
  },
];

export const CURATED_LOOKS_DATA: CuratedLook[] = CURATED_LOOKS.map((look) => ({
  ...look,
  title: look.title || look.name,
  styleCategory: look.styleCategory || look.aesthetic,
  topId: look.topId || look.top?.id,
  bottomId: look.bottomId || look.bottom?.id,
  dressId: look.dressId || look.dress?.id,
  shoesId: look.shoesId || look.shoes?.id,
  accessoryId: look.accessoryId || look.accessory?.id,
}));

