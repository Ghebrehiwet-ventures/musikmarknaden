// V1 Category Taxonomy for Musical Gear Marketplace
// This is the locked category structure - do not modify without versioning

export interface Category {
  id: string;
  label: string;
}

export const CATEGORIES: Category[] = [
  { id: "instrument", label: "Instrument" },
  { id: "amplifiers", label: "Förstärkare" },
  { id: "pedals-effects", label: "Pedaler & Effekter" },
  { id: "studio", label: "Studio" },
  { id: "dj-live", label: "DJ & Live" },
  { id: "synth-modular", label: "Synth & Modulärt" },
  { id: "software-computers", label: "Mjukvara & Datorer" },
  { id: "accessories-parts", label: "Tillbehör & Delar" },
  { id: "services", label: "Tjänster" },
  { id: "other", label: "Övrigt" },
];

// Mapping from external/scraped category names to internal category IDs
// Add new mappings here as we encounter them from scraped sources
const CATEGORY_MAPPINGS: Record<string, string> = {
  // Instruments
  "gitarr": "instrument",
  "gitarrer": "instrument",
  "akustiska gitarrer": "instrument",
  "elgitarrer": "instrument",
  "basar": "instrument",
  "bas": "instrument",
  "trummor": "instrument",
  "drums": "instrument",
  "piano": "instrument",
  "keyboards": "instrument",
  "keyboard": "instrument",
  "blåsinstrument": "instrument",
  "stråkinstrument": "instrument",
  "ukulele": "instrument",
  
  // Amplifiers
  "förstärkare": "amplifiers",
  "forstarkare": "amplifiers",
  "gitarrförstärkare": "amplifiers",
  "basförstärkare": "amplifiers",
  "amp": "amplifiers",
  "amps": "amplifiers",
  
  // Pedals & Effects
  "pedaler": "pedals-effects",
  "pedaler & effekter": "pedals-effects",
  "effekter": "pedals-effects",
  "effects": "pedals-effects",
  
  // Studio
  "studio": "studio",
  "studio & scenutrustning": "studio",
  "inspelning": "studio",
  "recording": "studio",
  "mikrofon": "studio",
  "mikrofoner": "studio",
  "monitors": "studio",
  "högtalare": "studio",
  "ljudkort": "studio",
  "audio interface": "studio",
  
  // DJ & Live
  "dj": "dj-live",
  "dj-utrustning": "dj-live",
  "pa": "dj-live",
  "live": "dj-live",
  "scen": "dj-live",
  "ljus": "dj-live",
  "lighting": "dj-live",
  
  // Synth & Modular
  "synthar": "synth-modular",
  "synth": "synth-modular",
  "synthesizer": "synth-modular",
  "eurorack": "synth-modular",
  "modular": "synth-modular",
  
  // Software & Computers
  "mjukvara": "software-computers",
  "mjukvara & plug-ins": "software-computers",
  "plugins": "software-computers",
  "plug-ins": "software-computers",
  "datorer": "software-computers",
  "dator": "software-computers",
  "computer": "software-computers",
  
  // Accessories & Parts
  "tillbehör": "accessories-parts",
  "tillbehor": "accessories-parts",
  "accessories": "accessories-parts",
  "strängar": "accessories-parts",
  "kablar": "accessories-parts",
  "cases": "accessories-parts",
  "väskor": "accessories-parts",
  "hörlurar": "accessories-parts",
  "horlurar": "accessories-parts",
  "headphones": "accessories-parts",
  
  // Services
  "lektioner": "services",
  "lessons": "services",
  "replokaler": "services",
  "rehearsal": "services",
  "reparation": "services",
  "repair": "services",
  
  // Other / fallback
  "övrigt": "other",
  "other": "other",
};

/**
 * Maps an external/scraped category name to our internal category ID.
 * Returns "other" if no mapping is found.
 */
export function mapToInternalCategory(externalCategory: string | null | undefined): string {
  if (!externalCategory) return "other";
  
  const normalized = externalCategory.toLowerCase().trim();
  
  // Direct mapping
  if (CATEGORY_MAPPINGS[normalized]) {
    return CATEGORY_MAPPINGS[normalized];
  }
  
  // Partial match - check if any mapping key is contained in the external category
  for (const [key, value] of Object.entries(CATEGORY_MAPPINGS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value;
    }
  }
  
  return "other";
}

/**
 * Gets the display label for a category ID
 */
export function getCategoryLabel(categoryId: string): string {
  const category = CATEGORIES.find(c => c.id === categoryId);
  return category?.label || "Other";
}
