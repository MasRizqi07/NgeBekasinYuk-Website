export const LISTING_CATEGORY_SLUGS = [
  "smartphone",
  "laptop",
  "audio",
  "pc-gaming",
  "console",
  "camera",
  "accessories",
] as const;

export type ListingCategorySlug = (typeof LISTING_CATEGORY_SLUGS)[number];

export const CATEGORY_LABELS: Record<ListingCategorySlug, string> = {
  smartphone: "Smartphone & Tablet",
  laptop: "Laptop & Ultrabook",
  audio: "Audio & Headphone",
  "pc-gaming": "PC Part & GPU",
  console: "Konsol & Handheld",
  camera: "Kamera & Lensa",
  accessories: "Aksesoris Tech",
};

export const LISTING_CONDITION_VALUES = [
  "BRAND_NEW_SEALED",
  "BRAND_NEW",
  "LIKE_NEW",
  "VERY_GOOD",
  "NORMAL_USE",
  "FAIR",
  "MINOR_SCRATCHES",
  "MINOR_DEFECT",
] as const;

export type ListingConditionCode = (typeof LISTING_CONDITION_VALUES)[number];

export interface ConditionDisplayMeta {
  label: string;
  score: number;
  equivalentCodes: ListingConditionCode[];
}

export const CONDITION_META: Record<ListingConditionCode, ConditionDisplayMeta> = {
  BRAND_NEW_SEALED: {
    label: "Segel Baru (100%)",
    score: 100,
    equivalentCodes: ["BRAND_NEW_SEALED", "BRAND_NEW"],
  },
  BRAND_NEW: {
    label: "Segel Baru (100%)",
    score: 100,
    equivalentCodes: ["BRAND_NEW", "BRAND_NEW_SEALED"],
  },
  LIKE_NEW: {
    label: "Seperti Baru (99%)",
    score: 99,
    equivalentCodes: ["LIKE_NEW"],
  },
  VERY_GOOD: {
    label: "Sangat Mulus (96%)",
    score: 96,
    equivalentCodes: ["VERY_GOOD", "NORMAL_USE"],
  },
  NORMAL_USE: {
    label: "Pemakaian Wajar (95%)",
    score: 95,
    equivalentCodes: ["NORMAL_USE", "VERY_GOOD"],
  },
  FAIR: {
    label: "Kondisi Layak (90%)",
    score: 90,
    equivalentCodes: ["FAIR", "MINOR_SCRATCHES"],
  },
  MINOR_SCRATCHES: {
    label: "Lecet Pemakaian (90%)",
    score: 90,
    equivalentCodes: ["MINOR_SCRATCHES", "FAIR"],
  },
  MINOR_DEFECT: {
    label: "Minus / Rusak Ringan",
    score: 80,
    equivalentCodes: ["MINOR_DEFECT"],
  },
};

export function getCategoryLabel(category: string): string {
  return (CATEGORY_LABELS as Record<string, string>)[category] ?? "Gadget Lainnya";
}

export function getConditionDisplay(condition: string): ConditionDisplayMeta {
  return (
    (CONDITION_META as Record<string, ConditionDisplayMeta>)[condition] ?? {
      label: condition,
      score: 90,
      equivalentCodes: [condition as ListingConditionCode],
    }
  );
}

export function expandConditionFilter(conditionParam: string): string[] {
  const parts = conditionParam
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const expanded = new Set<string>();
  for (const code of parts) {
    const meta = (CONDITION_META as Record<string, ConditionDisplayMeta>)[code];
    if (meta) {
      for (const eq of meta.equivalentCodes) {
        expanded.add(eq);
      }
    }
  }
  return Array.from(expanded);
}
