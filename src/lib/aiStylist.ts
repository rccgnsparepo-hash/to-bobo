// Real AI Stylist Service using Google GenAI SDK (gemini-3.8-flash)
import { GoogleGenAI } from "@google/genai";
import { GARMENT_CATALOG, type GarmentItem, type CurrentOutfit, type FashionStyle } from "./fashionData";
import { getUserStylePreferences } from "./fashionWardrobe";

export interface StylistRecommendation {
  lookTitle: string;
  occasion: string;
  stylingRule: string;
  aesthetic: FashionStyle;
  outfit: CurrentOutfit;
  colorPalette: string[];
  stylistAdvice: string;
  source: "gemini" | "curated_algorithm";
}

/**
 * Intelligent Stylist Recommender
 * Connects to Gemini API when available, or executes domain-grounded algorithmic fashion rules.
 */
export async function consultAiStylist(
  prompt: string,
  targetGarment?: GarmentItem
): Promise<StylistRecommendation> {
  const prefs = getUserStylePreferences();

  const catalogSummary = GARMENT_CATALOG.map((g) => ({
    id: g.id,
    name: g.name,
    category: g.category,
    style: g.style,
    brand: g.brand,
    colors: g.availableColors.map((c) => c.name).join(", "),
    priceUSD: g.priceUSD,
  }));

  // Check for Gemini API key in env
  const apiKey =
    (typeof process !== "undefined" ? process.env?.GEMINI_API_KEY : undefined) ||
    (typeof import.meta !== "undefined" ? (import.meta as any).env?.VITE_GEMINI_API_KEY : undefined);

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const systemInstruction = `You are a high-fashion stylist for Flick Fashion Studio.
Given the user request, style preferences, and the exact garment catalog below, recommend a cohesive outfit.
Return ONLY valid JSON matching this schema:
{
  "lookTitle": string,
  "occasion": string,
  "stylingRule": string,
  "aesthetic": string,
  "topId": string or null,
  "bottomId": string or null,
  "dressId": string or null,
  "shoesId": string,
  "accessoryId": string or null,
  "colorPalette": string[],
  "stylistAdvice": string
}
Catalog items available: ${JSON.stringify(catalogSummary)}`;

      const userMessage = `User request: "${prompt}".
${targetGarment ? `Must incorporate this item: ID ${targetGarment.id} (${targetGarment.name})` : ""}
User style preferences: ${JSON.stringify(prefs)}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: userMessage,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          temperature: 0.7,
        },
      });

      const parsed = JSON.parse(response.text || "{}");
      if (parsed.lookTitle && parsed.shoesId) {
        const outfit: CurrentOutfit = {
          top: GARMENT_CATALOG.find((g) => g.id === parsed.topId),
          bottom: GARMENT_CATALOG.find((g) => g.id === parsed.bottomId),
          dress: GARMENT_CATALOG.find((g) => g.id === parsed.dressId),
          shoes: GARMENT_CATALOG.find((g) => g.id === parsed.shoesId) || GARMENT_CATALOG.find((g) => g.category === "shoes"),
          accessory: GARMENT_CATALOG.find((g) => g.id === parsed.accessoryId),
        };

        return {
          lookTitle: parsed.lookTitle,
          occasion: parsed.occasion || "Campus / Casual",
          stylingRule: parsed.stylingRule || "Tonal Balance & Layering",
          aesthetic: (parsed.aesthetic as FashionStyle) || "Campus Fits",
          outfit,
          colorPalette: parsed.colorPalette || ["#D4B996", "#1A1A1A"],
          stylistAdvice: parsed.stylistAdvice || "A balanced, comfortable ensemble crafted for your proportions.",
          source: "gemini",
        };
      }
    } catch (err) {
      console.warn("Gemini AI Stylist fallback to curated rules engine:", err);
    }
  }

  // Grounded High-Fashion Algorithmic Fallback Engine
  const lower = prompt.toLowerCase();
  let selectedAesthetic: FashionStyle = "Campus Fits";
  let targetOccasion = "Campus & Daily Wear";

  if (lower.includes("date") || lower.includes("dinner") || lower.includes("night")) {
    selectedAesthetic = "Date Night";
    targetOccasion = "Romantic Dinner / Date Night";
  } else if (lower.includes("traditional") || lower.includes("african") || lower.includes("naija") || lower.includes("wedding")) {
    selectedAesthetic = "African Traditional";
    targetOccasion = "Cultural Celebration & Sunday Best";
  } else if (lower.includes("street") || lower.includes("hype") || lower.includes("kpop")) {
    selectedAesthetic = "Streetwear";
    targetOccasion = "City Outing & Concert";
  } else if (lower.includes("formal") || lower.includes("presentation") || lower.includes("interview") || lower.includes("class")) {
    selectedAesthetic = "Old Money";
    targetOccasion = "Academic Presentation & Formal Networking";
  }

  // Filter or match pieces
  let top = GARMENT_CATALOG.find((g) => g.category === "top" && g.style === selectedAesthetic);
  let bottom = GARMENT_CATALOG.find((g) => g.category === "bottom" && g.style === selectedAesthetic);
  let dress = GARMENT_CATALOG.find((g) => g.category === "dress" && g.style === selectedAesthetic);
  let shoes = GARMENT_CATALOG.find((g) => g.category === "shoes" && (g.style === selectedAesthetic || g.style === "Casual"));
  let accessory = GARMENT_CATALOG.find((g) => g.category === "accessory");

  // If anchoring around target garment
  if (targetGarment) {
    if (targetGarment.category === "top") top = targetGarment;
    else if (targetGarment.category === "bottom") bottom = targetGarment;
    else if (targetGarment.category === "dress") {
      dress = targetGarment;
      top = undefined;
      bottom = undefined;
    } else if (targetGarment.category === "shoes") shoes = targetGarment;
    else if (targetGarment.category === "accessory") accessory = targetGarment;
  }

  // Fallbacks if not found
  if (!top && !dress) top = GARMENT_CATALOG.find((g) => g.category === "top")!;
  if (!bottom && !dress) bottom = GARMENT_CATALOG.find((g) => g.category === "bottom")!;
  if (!shoes) shoes = GARMENT_CATALOG.find((g) => g.category === "shoes")!;

  const adviceByStyle: Record<FashionStyle, { rule: string; advice: string }> = {
    "Campus Fits": {
      rule: "The 70/30 Comfort-to-Structure Ratio",
      advice: "Keep the knit silhouette relaxed up top, then ground it with a textured bottom and platform sole for long campus walks.",
    },
    Streetwear: {
      rule: "High-Contrast Accent Anchor",
      advice: "Combine bold tactical zip silhouettes with neutral base tones to let statement accessories pop.",
    },
    "Date Night": {
      rule: "Fluid Bias Grace & Minimalist Contrast",
      advice: "Pair luminous jewel or satin tones with understated footwear to emphasize movement and candlelight reflections.",
    },
    "African Traditional": {
      rule: "Regal Symmetry & Focal Embroidery",
      advice: "Anchor bespoke tunic stitch work with clean tapered pants and burnished leather mules for timeless dignity.",
    },
    "Old Money": {
      rule: "The High-Low Tailoring Balance",
      advice: "Combine soft-shoulder unstructured blazers with fluid wide trousers and hand-welted leather penny loafers.",
    },
    Minimalist: {
      rule: "Architectural Proportion & Monochromatic Texture",
      advice: "Rely on raw fabric weights (organic cotton, duck canvas) rather than heavy branding.",
    },
    Casual: {
      rule: "The Sandwich Rule",
      advice: "Coordinate upper tones with footwear accents while letting selvedge denim create natural contrast.",
    },
    Formal: {
      rule: "Tailored Line Integrity",
      advice: "Ensure crisp cuffs and spotless leather to exude understated confidence.",
    },
    Y2K: {
      rule: "Cyber Metallic Contrast",
      advice: "Shield eyewear paired with mini silhouettes and chunky soles.",
    },
    Athleisure: {
      rule: "Dynamic Compression & Breathability",
      advice: "Clean lines that transit smoothly between gym sessions and casual coffee runs.",
    },
  };

  const styleMeta = adviceByStyle[selectedAesthetic] || adviceByStyle["Campus Fits"];

  return {
    lookTitle: `${selectedAesthetic} Curated Capsule`,
    occasion: targetOccasion,
    stylingRule: styleMeta.rule,
    aesthetic: selectedAesthetic,
    outfit: { top, bottom, dress, shoes, accessory },
    colorPalette: top?.availableColors?.map((c) => c.hex) || ["#D4B996", "#1A1A1A"],
    stylistAdvice: styleMeta.advice,
    source: "curated_algorithm",
  };
}
