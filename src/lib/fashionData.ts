// Flick Fashion Studio Data Architecture
// Real fashion assets, curated looks, models, and garment specifications

export type GarmentCategory = "top" | "bottom" | "dress" | "shoes" | "accessory";

export type FashionStyle =
  | "Streetwear"
  | "Old Money"
  | "Minimalist"
  | "Casual"
  | "Formal"
  | "Y2K"
  | "Athleisure"
  | "African Traditional"
  | "Date Night"
  | "Campus Fits";

export interface GarmentItem {
  id: string;
  name: string;
  category: GarmentCategory;
  style: FashionStyle;
  brand: string;
  seller: string;
  priceUSD: number;
  priceCNY: number;
  priceNGN: number;
  imageUrl: string;
  thumbnailUrl: string;
  availableColors: { name: string; hex: string }[];
  availableSizes: string[];
  description: string;
  material: string;
  inStock: boolean;
  stockCount: number;
  tags: string[];
}

export interface ModelAvatar {
  id: string;
  name: string;
  gender: "female" | "male" | "unisex";
  avatarThumb: string;
  bio: string;
  height: string;
  baseImages: {
    front: string;
    side: string;
    back: string;
  };
}

export interface CuratedLook {
  id: string;
  title: string;
  styleCategory: FashionStyle;
  occasion: string;
  description: string;
  coverImage: string;
  angles: {
    front: string;
    side: string;
    back: string;
  };
  modelId: string;
  topId?: string;
  bottomId?: string;
  dressId?: string;
  shoesId: string;
  accessoryId?: string;
  swatches: string[];
  stylingRule: string;
  likes: number;
  creator: {
    name: string;
    handle: string;
    avatar: string;
  };
}

export interface CurrentOutfit {
  top?: GarmentItem;
  bottom?: GarmentItem;
  dress?: GarmentItem;
  shoes?: GarmentItem;
  accessory?: GarmentItem;
}

export const FASHION_MODELS: ModelAvatar[] = [
  {
    id: "mei",
    name: "Mei",
    gender: "female",
    avatarThumb: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80",
    bio: "College sophomore • Acubi, Y2K & street casual fits",
    height: "168 cm",
    baseImages: {
      front: "/assets/aistudio/download__38__1d85c90f.jpg",
      side: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=85",
      back: "/assets/aistudio/download__38__1d85c90f.jpg",
    },
  },
  {
    id: "kai",
    name: "Kai",
    gender: "male",
    avatarThumb: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80",
    bio: "Campus senior • Tailored minimalist & tech streetwear",
    height: "182 cm",
    baseImages: {
      front: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=85",
      side: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=85",
      back: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=85",
    },
  },
  {
    id: "zara",
    name: "Zara",
    gender: "female",
    avatarThumb: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop&q=80",
    bio: "Arts major • Vintage knitwear & modern African fusion",
    height: "172 cm",
    baseImages: {
      front: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=85",
      side: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=85",
      back: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=85",
    },
  },
  {
    id: "leo",
    name: "Leo",
    gender: "male",
    avatarThumb: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80",
    bio: "Athlete & creator • Athleisure, heavy hoodies & sneakers",
    height: "185 cm",
    baseImages: {
      front: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=85",
      side: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=85",
      back: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=85",
    },
  },
];

export const FASHION_HAIRSTYLES = [
  { id: "twin_braids", name: "Twin Braids / Pigtails", icon: "👧" },
  { id: "wavy_bob", name: "Wavy Bob", icon: "💇‍♀️" },
  { id: "afro_curls", name: "Natural Curls / Afro", icon: "✨" },
  { id: "sleek_bun", name: "Sleek High Bun", icon: "👱‍♀️" },
  { id: "fringe", name: "Curtain Fringe", icon: "🧝‍♀️" },
  { id: "short_fade", name: "Clean Low Fade", icon: "🧔" },
];

export const GARMENT_CATALOG: GarmentItem[] = [
  // ===== TOPS =====
  {
    id: "top-acubi-cardigan",
    name: "Oversized Cable Tie-Back Cardigan",
    category: "top",
    style: "Campus Fits",
    brand: "Loom & Knit",
    seller: "Acubi Official",
    priceUSD: 32,
    priceCNY: 32,
    priceNGN: 48000,
    imageUrl: "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=600&auto=format&fit=crop&q=80",
    thumbnailUrl: "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=180&auto=format&fit=crop&q=80",
    availableColors: [
      { name: "Oatmeal Camel", hex: "#D4B996" },
      { name: "Charcoal Ash", hex: "#3A3D40" },
      { name: "Cream White", hex: "#F5F3EF" },
    ],
    availableSizes: ["XS", "S", "M", "L"],
    description: "Chunky cable-knit cardigan with delicate back ribbon ties. Open front silhouette tailored for layering over crop tops or slip dresses.",
    material: "85% Wool Blend, 15% Soft Acrylic",
    inStock: true,
    stockCount: 18,
    tags: ["Acubi", "Knitwear", "Cardigan", "Campus"],
  },
  {
    id: "top-kpop-windbreaker",
    name: "Crop Utility Windbreaker with Neon Piping",
    category: "top",
    style: "Streetwear",
    brand: "AeroCore",
    seller: "Seoul Hype Vault",
    priceUSD: 48,
    priceCNY: 340,
    priceNGN: 72000,
    imageUrl: "https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?w=600&auto=format&fit=crop&q=80",
    thumbnailUrl: "https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?w=180&auto=format&fit=crop&q=80",
    availableColors: [
      { name: "Matte Black", hex: "#1A1A1A" },
      { name: "Electric Orange", hex: "#FF5E00" },
      { name: "Cyber Silver", hex: "#C0C0C0" },
    ],
    availableSizes: ["S", "M", "L"],
    description: "Cropped lightweight weather-resistant shell jacket with reflective safety piping and double zip closures.",
    material: "100% Recycled Ripstop Nylon",
    inStock: true,
    stockCount: 24,
    tags: ["KPOP", "Techwear", "Windbreaker", "Streetwear"],
  },
  {
    id: "top-heavy-tee",
    name: "Boxy Heavyweight Drop-Shoulder Tee",
    category: "top",
    style: "Casual",
    brand: "Standard Supply",
    seller: "Studio Atelier",
    priceUSD: 28,
    priceCNY: 198,
    priceNGN: 42000,
    imageUrl: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&auto=format&fit=crop&q=80",
    thumbnailUrl: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=180&auto=format&fit=crop&q=80",
    availableColors: [
      { name: "Vintage Chalk", hex: "#F3F1EC" },
      { name: "Washed Slate", hex: "#566270" },
      { name: "Faded Olive", hex: "#556B2F" },
    ],
    availableSizes: ["S", "M", "L", "XL"],
    description: "260 GSM organic combed cotton tee with reinforced ribbed crewneck and seamless side construction.",
    material: "100% Organic Cotton (260 GSM)",
    inStock: true,
    stockCount: 45,
    tags: ["Basics", "Heavyweight", "Oversized", "Everyday"],
  },
  {
    id: "top-slate-blazer",
    name: "Unstructured Oversized Slate Blazer",
    category: "top",
    style: "Old Money",
    brand: "Savile & Co",
    seller: "Heritage Clothiers",
    priceUSD: 75,
    priceCNY: 530,
    priceNGN: 112000,
    imageUrl: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=600&auto=format&fit=crop&q=80",
    thumbnailUrl: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=180&auto=format&fit=crop&q=80",
    availableColors: [
      { name: "Slate Charcoal", hex: "#2C3539" },
      { name: "Deep Navy", hex: "#1B263B" },
      { name: "Rich Camel", hex: "#B8860B" },
    ],
    availableSizes: ["36R", "38R", "40R", "42R"],
    description: "Modern soft-shoulder blazer with notched lapels and horn buttons. Perfect for university presentations and smart dinners.",
    material: "Tropical Wool & Linen Blend",
    inStock: true,
    stockCount: 12,
    tags: ["Blazer", "Old Money", "Formal", "Tailored"],
  },
  {
    id: "top-senator-tunic",
    name: "Contemporary Senator Tunic with Geometric Embroidery",
    category: "top",
    style: "African Traditional",
    brand: "AfroChic Couture",
    seller: "Lagos Bespoke Guild",
    priceUSD: 68,
    priceCNY: 480,
    priceNGN: 95000,
    imageUrl: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=600&auto=format&fit=crop&q=80",
    thumbnailUrl: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=180&auto=format&fit=crop&q=80",
    availableColors: [
      { name: "Royal Midnight Navy", hex: "#0B1D3A" },
      { name: "Pristine White", hex: "#FFFFFF" },
      { name: "Burgundy Wine", hex: "#58111A" },
    ],
    availableSizes: ["M", "L", "XL", "XXL"],
    description: "Modern minimalist Senator tunic crafted with signature chest geometric stitch work and band collar.",
    material: "Cashmere Wool & Italian Poly-Viscose",
    inStock: true,
    stockCount: 15,
    tags: ["Senator", "Naija", "African Heritage", "Bespoke"],
  },

  // ===== BOTTOMS =====
  {
    id: "btm-acubi-skort",
    name: "High-Waist Tiered Linen Skort",
    category: "bottom",
    style: "Campus Fits",
    brand: "Loom & Knit",
    seller: "Acubi Official",
    priceUSD: 40,
    priceCNY: 40,
    priceNGN: 60000,
    imageUrl: "https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=600&auto=format&fit=crop&q=80",
    thumbnailUrl: "https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=180&auto=format&fit=crop&q=80",
    availableColors: [
      { name: "Sand Dune", hex: "#C2B280" },
      { name: "Onyx Black", hex: "#111111" },
      { name: "Sage Mist", hex: "#9CAF88" },
    ],
    availableSizes: ["XS", "S", "M", "L"],
    description: "Pleated A-line silhouette with built-in hidden stretch shorts for effortless all-day campus movement.",
    material: "100% Belgian Washed Linen with Cotton Lining",
    inStock: true,
    stockCount: 22,
    tags: ["Skort", "Linen", "Pleated", "Acubi"],
  },
  {
    id: "btm-cargo-shorts",
    name: "Pleated Contrast Cargo Mini Shorts",
    category: "bottom",
    style: "Streetwear",
    brand: "AeroCore",
    seller: "Seoul Hype Vault",
    priceUSD: 36,
    priceCNY: 260,
    priceNGN: 54000,
    imageUrl: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=600&auto=format&fit=crop&q=80",
    thumbnailUrl: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=180&auto=format&fit=crop&q=80",
    availableColors: [
      { name: "Stealth Black", hex: "#1A1A1A" },
      { name: "Combat Khaki", hex: "#8A795D" },
    ],
    availableSizes: ["S", "M", "L"],
    description: "Techwear-inspired mini cargo shorts with heavy-duty webbing belts and zippered tactical pockets.",
    material: "DWR Stretch Twill",
    inStock: true,
    stockCount: 30,
    tags: ["Cargo", "Shorts", "Techwear", "Buckles"],
  },
  {
    id: "btm-carpenter-denim",
    name: "Relaxed Carpenter Raw Denim",
    category: "bottom",
    style: "Casual",
    brand: "Standard Supply",
    seller: "Studio Atelier",
    priceUSD: 52,
    priceCNY: 370,
    priceNGN: 78000,
    imageUrl: "https://images.unsplash.com/photo-1542272604-780c96856592?w=600&auto=format&fit=crop&q=80",
    thumbnailUrl: "https://images.unsplash.com/photo-1542272604-780c96856592?w=180&auto=format&fit=crop&q=80",
    availableColors: [
      { name: "Medium Stonewash", hex: "#4B6584" },
      { name: "Raw Indigo", hex: "#1E3799" },
      { name: "Washed Black", hex: "#2F3640" },
    ],
    availableSizes: ["28x30", "30x32", "32x32", "34x32", "36x34"],
    description: "13.5oz non-stretch selvedge denim featuring double tool pockets and a classic hammer loop.",
    material: "100% Selvedge Cotton",
    inStock: true,
    stockCount: 19,
    tags: ["Denim", "Carpenter", "Jeans", "Skate"],
  },
  {
    id: "btm-pleated-trousers",
    name: "Wide-Leg Double-Pleated Tailored Trousers",
    category: "bottom",
    style: "Old Money",
    brand: "Savile & Co",
    seller: "Heritage Clothiers",
    priceUSD: 48,
    priceCNY: 340,
    priceNGN: 72000,
    imageUrl: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=600&auto=format&fit=crop&q=80",
    thumbnailUrl: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=180&auto=format&fit=crop&q=80",
    availableColors: [
      { name: "Alabaster White", hex: "#FDFBF7" },
      { name: "Charcoal Herringbone", hex: "#3A3B3C" },
      { name: "Dark Olive", hex: "#354230" },
    ],
    availableSizes: ["30", "32", "34", "36"],
    description: "High-waisted trousers with dramatic double front pleats and side adjuster tabs. Drape beautifully over boots or loafers.",
    material: "Poly-Viscose Wool Blend with Fluid Drape",
    inStock: true,
    stockCount: 14,
    tags: ["Trousers", "Pleated", "Wide-Leg", "Formal"],
  },
  {
    id: "btm-senator-pants",
    name: "Crisp Tapered Linen Senator Pants",
    category: "bottom",
    style: "African Traditional",
    brand: "AfroChic Couture",
    seller: "Lagos Bespoke Guild",
    priceUSD: 45,
    priceCNY: 320,
    priceNGN: 65000,
    imageUrl: "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=600&auto=format&fit=crop&q=80",
    thumbnailUrl: "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=180&auto=format&fit=crop&q=80",
    availableColors: [
      { name: "Pure White", hex: "#FFFFFF" },
      { name: "Midnight Navy", hex: "#0B1D3A" },
      { name: "Beige Gold", hex: "#D4AF37" },
    ],
    availableSizes: ["30", "32", "34", "36", "38"],
    description: "Bespoke tailored trousers with sleek ankle break and concealed pocket zip closures.",
    material: "Premium Linen Blend",
    inStock: true,
    stockCount: 17,
    tags: ["Senator", "Linen", "Traditional", "Tapered"],
  },

  // ===== DRESSES =====
  {
    id: "dress-silk-slip",
    name: "Cowl Neck Bias-Cut Satin Midi Dress",
    category: "dress",
    style: "Date Night",
    brand: "Maison Soie",
    seller: "Atelier Paris",
    priceUSD: 85,
    priceCNY: 600,
    priceNGN: 130000,
    imageUrl: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600&auto=format&fit=crop&q=80",
    thumbnailUrl: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=180&auto=format&fit=crop&q=80",
    availableColors: [
      { name: "Emerald Glaze", hex: "#097969" },
      { name: "Champagne Pearl", hex: "#F7E7CE" },
      { name: "Noir Black", hex: "#000000" },
    ],
    availableSizes: ["XS", "S", "M", "L"],
    description: "Floor-grazing bias cut slip dress designed with a flattering fluid drape, adjustable spaghetti straps, and side slit.",
    material: "100% Heavy Silk Charmeuse",
    inStock: true,
    stockCount: 11,
    tags: ["Dress", "Satin", "Evening", "Date Night"],
  },
  {
    id: "dress-ankara-flair",
    name: "Modern Ankara Off-Shoulder Corset Dress",
    category: "dress",
    style: "African Traditional",
    brand: "AfroChic Couture",
    seller: "Lagos Bespoke Guild",
    priceUSD: 92,
    priceCNY: 650,
    priceNGN: 145000,
    imageUrl: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600&auto=format&fit=crop&q=80",
    thumbnailUrl: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=180&auto=format&fit=crop&q=80",
    availableColors: [
      { name: "Vibrant Gold & Teal", hex: "#E5A93C" },
      { name: "Indigo Motif", hex: "#2C3E50" },
    ],
    availableSizes: ["S", "M", "L"],
    description: "Structured corset bodice meeting an asymmetrical flared ruffle skirt in authentic African wax print.",
    material: "100% Premium Dutch Wax Cotton",
    inStock: true,
    stockCount: 8,
    tags: ["Ankara", "Corset", "Heritage", "Celebration"],
  },

  // ===== SHOES =====
  {
    id: "shoe-platform-boots",
    name: "Chunky Platform Suede Lug Boots",
    category: "shoes",
    style: "Campus Fits",
    brand: "Tread & Timber",
    seller: "Acubi Official",
    priceUSD: 65,
    priceCNY: 420,
    priceNGN: 98000,
    imageUrl: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=600&auto=format&fit=crop&q=80",
    thumbnailUrl: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=180&auto=format&fit=crop&q=80",
    availableColors: [
      { name: "Camel Suede", hex: "#8C6D53" },
      { name: "Espresso Brown", hex: "#3D2B1F" },
      { name: "Jet Black", hex: "#111111" },
    ],
    availableSizes: ["37", "38", "39", "40", "41"],
    description: "5cm lightweight EVA foam platform soles paired with plush water-repellent suede uppers and memory foam insole.",
    material: "100% Genuine Oiled Cow Suede with EVA Platform",
    inStock: true,
    stockCount: 20,
    tags: ["Boots", "Platform", "Suede", "Winter"],
  },
  {
    id: "shoe-samba-retro",
    name: "Retro Gum-Sole Court Low Sneakers",
    category: "shoes",
    style: "Casual",
    brand: "Standard Supply",
    seller: "Studio Atelier",
    priceUSD: 100,
    priceCNY: 720,
    priceNGN: 150000,
    imageUrl: "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=600&auto=format&fit=crop&q=80",
    thumbnailUrl: "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=180&auto=format&fit=crop&q=80",
    availableColors: [
      { name: "Cloud White / Black", hex: "#FFFFFF" },
      { name: "Core Black / White", hex: "#151515" },
    ],
    availableSizes: ["39", "40", "41", "42", "43", "44"],
    description: "Low-profile indoor football court classic with suede T-toe overlay and iconic caramel gum rubber outsole.",
    material: "Full-Grain Leather with Suede Overlays",
    inStock: true,
    stockCount: 35,
    tags: ["Sneakers", "Retro", "Gum Sole", "Everyday"],
  },
  {
    id: "shoe-penny-loafers",
    name: "Polished Black Calfskin Penny Loafers",
    category: "shoes",
    style: "Old Money",
    brand: "Savile & Co",
    seller: "Heritage Clothiers",
    priceUSD: 95,
    priceCNY: 670,
    priceNGN: 142000,
    imageUrl: "https://images.unsplash.com/photo-1614252369475-531eba835eb1?w=600&auto=format&fit=crop&q=80",
    thumbnailUrl: "https://images.unsplash.com/photo-1614252369475-531eba835eb1?w=180&auto=format&fit=crop&q=80",
    availableColors: [
      { name: "High-Shine Black", hex: "#0D0D0D" },
      { name: "Oxblood Cordovan", hex: "#4A1521" },
    ],
    availableSizes: ["40", "41", "42", "43", "44", "45"],
    description: "Goodyear-welted penny loafers handmade with supple calf leather and stacked leather heels.",
    material: "100% Box Calf Leather",
    inStock: true,
    stockCount: 16,
    tags: ["Loafers", "Formal", "Old Money", "Leather"],
  },
  {
    id: "shoe-burnished-mules",
    name: "Handcrafted Burnished Leather Mules",
    category: "shoes",
    style: "African Traditional",
    brand: "AfroChic Couture",
    seller: "Lagos Bespoke Guild",
    priceUSD: 78,
    priceCNY: 550,
    priceNGN: 110000,
    imageUrl: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=600&auto=format&fit=crop&q=80",
    thumbnailUrl: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=180&auto=format&fit=crop&q=80",
    availableColors: [
      { name: "Cognac Tan", hex: "#9E4716" },
      { name: "Ebony Black", hex: "#111111" },
    ],
    availableSizes: ["41", "42", "43", "44", "45"],
    description: "Slip-on leather slippers featuring embossed hand-carved textures and cushioned footbeds.",
    material: "Vegetable-Tanned Cowhide",
    inStock: true,
    stockCount: 20,
    tags: ["Mules", "Traditional", "Slip-On", "Bespoke"],
  },

  // ===== ACCESSORIES =====
  {
    id: "acc-canvas-tote",
    name: "Heavy Raw Canvas Architect Tote Bag",
    category: "accessory",
    style: "Minimalist",
    brand: "Standard Supply",
    seller: "Studio Atelier",
    priceUSD: 24,
    priceCNY: 170,
    priceNGN: 36000,
    imageUrl: "https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&auto=format&fit=crop&q=80",
    thumbnailUrl: "https://images.unsplash.com/photo-1544816155-12df9643f363?w=180&auto=format&fit=crop&q=80",
    availableColors: [
      { name: "Natural Ecru", hex: "#EAE6DF" },
      { name: "Coal Black", hex: "#1A1A1A" },
    ],
    availableSizes: ["One Size"],
    description: "16oz structured canvas tote capable of holding a 16-inch laptop, sketchbooks, and daily campus essentials.",
    material: "100% Unbleached Heavy Duck Canvas",
    inStock: true,
    stockCount: 50,
    tags: ["Tote", "Canvas", "Minimalist", "Bag"],
  },
  {
    id: "acc-y2k-shades",
    name: "Frameless Silver Cyber Sunglasses",
    category: "accessory",
    style: "Y2K",
    brand: "AeroCore",
    seller: "Seoul Hype Vault",
    priceUSD: 22,
    priceCNY: 155,
    priceNGN: 32000,
    imageUrl: "https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=600&auto=format&fit=crop&q=80",
    thumbnailUrl: "https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=180&auto=format&fit=crop&q=80",
    availableColors: [
      { name: "Chrome Mirror", hex: "#E0E0E0" },
      { name: "Smoke Tint", hex: "#424242" },
    ],
    availableSizes: ["One Size"],
    description: "Curved aerodynamic wraparound shield shades with UV400 anti-glare protection.",
    material: "Titanium Finish Polycarbonate",
    inStock: true,
    stockCount: 40,
    tags: ["Sunglasses", "Y2K", "Cyber", "Silver"],
  },
];

export const CURATED_LOOKS_DATA: CuratedLook[] = [
  {
    id: "look-acubi-fairy",
    title: "Acubi fairy",
    styleCategory: "Campus Fits",
    occasion: "Campus & Street",
    description: "Tonal earth balance with cozy knitwear, pleated skort, and platform chunky boots.",
    coverImage: "/assets/aistudio/download__38__1d85c90f.jpg",
    angles: {
      front: "/assets/aistudio/download__38__1d85c90f.jpg",
      side: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=85",
      back: "/assets/aistudio/download__38__1d85c90f.jpg",
    },
    modelId: "mei",
    topId: "top-acubi-cardigan",
    bottomId: "btm-acubi-skort",
    shoesId: "shoe-platform-boots",
    accessoryId: "acc-canvas-tote",
    swatches: ["#D4B996", "#8C6D53"],
    stylingRule: "Tonal Earth Harmony: Warm camel knitwear balanced with stacked socks and lug-sole boots.",
    likes: 842,
    creator: {
      name: "Mei Lin",
      handle: "@meistyles",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
    },
  },
  {
    id: "look-kpop-idol",
    title: "KPOP Idol Stage",
    styleCategory: "Streetwear",
    occasion: "Concert & Party",
    description: "High-energy techwear silhouette combining neon-piped crop shell with cargo buckle shorts.",
    coverImage: "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=600&q=80",
    angles: {
      front: "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=800&q=85",
      side: "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=800&q=85",
      back: "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=800&q=85",
    },
    modelId: "mei",
    topId: "top-kpop-windbreaker",
    bottomId: "btm-cargo-shorts",
    shoesId: "shoe-samba-retro",
    accessoryId: "acc-y2k-shades",
    swatches: ["#FF8C00", "#1A1A1A", "#FFFFFF"],
    stylingRule: "High-Contrast Statement: Let the vivid orange accent pop against monochromatic black straps.",
    likes: 1240,
    creator: {
      name: "Hana Sato",
      handle: "@hanakpop",
      avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80",
    },
  },
  {
    id: "look-street-casual",
    title: "Street Casual Skater",
    styleCategory: "Casual",
    occasion: "Campus Lecture",
    description: "Effortless relaxed carpenter denim with 260 GSM drop-shoulder boxy tee.",
    coverImage: "https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?auto=format&fit=crop&w=600&q=80",
    angles: {
      front: "https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?auto=format&fit=crop&w=800&q=85",
      side: "https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?auto=format&fit=crop&w=800&q=85",
      back: "https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?auto=format&fit=crop&w=800&q=85",
    },
    modelId: "kai",
    topId: "top-heavy-tee",
    bottomId: "btm-carpenter-denim",
    shoesId: "shoe-samba-retro",
    accessoryId: "acc-canvas-tote",
    swatches: ["#FFFFFF", "#2B2D42", "#8D99AE"],
    stylingRule: "The Sandwich Rule: Balance the upper white silhouette with clean white/gum-sole footwear below.",
    likes: 980,
    creator: {
      name: "Kai Adams",
      handle: "@kai_supply",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
    },
  },
  {
    id: "look-old-money-formal",
    title: "Savile Old Money",
    styleCategory: "Old Money",
    occasion: "Presentation & Networking",
    description: "Double-pleated alabaster wide trousers anchored by unstructured slate blazer and penny loafers.",
    coverImage: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=600&q=80",
    angles: {
      front: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=800&q=85",
      side: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=800&q=85",
      back: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=800&q=85",
    },
    modelId: "kai",
    topId: "top-slate-blazer",
    bottomId: "btm-pleated-trousers",
    shoesId: "shoe-penny-loafers",
    swatches: ["#2C3539", "#FFFFFF", "#C5A059"],
    stylingRule: "The High-Low Balance: Structured formal upper paired with relaxed, modern wide trousers and polished calfskin.",
    likes: 1150,
    creator: {
      name: "Julian Vance",
      handle: "@julianvance",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80",
    },
  },
  {
    id: "look-naija-heritage",
    title: "Naija Modern Senator",
    styleCategory: "African Traditional",
    occasion: "Sunday Best & Cultural Gala",
    description: "Deep midnight blue Senator tunic with gold embroidery, crisp white trousers, and hand-burnished mules.",
    coverImage: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=600&q=80",
    angles: {
      front: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=85",
      side: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=85",
      back: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=85",
    },
    modelId: "leo",
    topId: "top-senator-tunic",
    bottomId: "btm-senator-pants",
    shoesId: "shoe-burnished-mules",
    swatches: ["#0B1D3A", "#FFFFFF", "#9E4716"],
    stylingRule: "Focal Contrast Rule: Rich deep navy tunic embroidery paired with crisp white pants and coral wrist beads.",
    likes: 1490,
    creator: {
      name: "Chukwudi Eze",
      handle: "@chukwudistyle",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
    },
  },
  {
    id: "look-date-night-emerald",
    title: "Emerald Satin Elegance",
    styleCategory: "Date Night",
    occasion: "Candlelight Dinner",
    description: "Heavy emerald silk slip dress paired with sleek platform heels and minimalist gold accessories.",
    coverImage: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=600&q=80",
    angles: {
      front: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=800&q=85",
      side: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=800&q=85",
      back: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=800&q=85",
    },
    modelId: "zara",
    dressId: "dress-silk-slip",
    shoesId: "shoe-platform-boots",
    swatches: ["#097969", "#F7E7CE", "#111111"],
    stylingRule: "Monochrome Grace: Fluid jewel tones paired with delicate minimalist accents let the natural silhouette shine.",
    likes: 1380,
    creator: {
      name: "Zara Adeyemi",
      handle: "@zarastyles",
      avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80",
    },
  },
];
