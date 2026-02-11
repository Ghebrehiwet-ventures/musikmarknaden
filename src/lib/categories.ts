// V1 Category Taxonomy for Musical Gear Marketplace
// This is the locked category structure - do not modify without versioning

import { 
  Guitar, 
  Volume2, 
  SlidersHorizontal, 
  Mic, 
  Disc3, 
  Piano, 
  Monitor, 
  Cable, 
  Wrench, 
  MoreHorizontal,
  LayoutGrid,
  Drum,
  Wind,
  Music,
  LucideIcon
} from "lucide-react";

export interface Category {
  id: string;
  label: string;
  icon: LucideIcon;
}

export const CATEGORIES: Category[] = [
  { id: "guitars-bass", label: "Gitarrer & Basar", icon: Guitar },
  { id: "drums-percussion", label: "Trummor & Slagverk", icon: Drum },
  { id: "keys-pianos", label: "Keyboards & Pianon", icon: Piano },
  { id: "wind-brass", label: "Blåsinstrument", icon: Wind },
  { id: "strings-other", label: "Stränginstrument", icon: Music },
  { id: "amplifiers", label: "Förstärkare", icon: Volume2 },
  { id: "pedals-effects", label: "Pedaler & Effekter", icon: SlidersHorizontal },
  { id: "studio", label: "Studio", icon: Mic },
  { id: "dj-live", label: "DJ & Live", icon: Disc3 },
  { id: "synth-modular", label: "Synth & Modulärt", icon: Piano },
  { id: "software-computers", label: "Mjukvara & Datorer", icon: Monitor },
  { id: "accessories-parts", label: "Tillbehör & Delar", icon: Cable },
  { id: "services", label: "Tjänster", icon: Wrench },
  { id: "other", label: "Övrigt", icon: MoreHorizontal },
];

export const ALL_CATEGORY_ICON = LayoutGrid;

/** For old URLs with ?category=instrument – match all instrument subcategories */
const INSTRUMENT_IDS = ["instrument", "guitars-bass", "drums-percussion", "keys-pianos", "wind-brass", "strings-other"] as const;

export function categoryMatchesFilter(adCategory: string, selectedCategory: string | null): boolean {
  if (!selectedCategory) return true;
  if (selectedCategory === "instrument") {
    return INSTRUMENT_IDS.includes(adCategory as (typeof INSTRUMENT_IDS)[number]);
  }
  return adCategory === selectedCategory;
}

// Mapping from external/scraped category names to internal category IDs
// Add new mappings here as we encounter them from scraped sources
const CATEGORY_MAPPINGS: Record<string, string> = {
  // Instruments - Swedish
  "gitarr": "instrument",
  "gitarrer": "instrument",
  "akustiska gitarrer": "instrument",
  "elgitarrer": "instrument",
  "basar": "instrument",
  "bas": "instrument",
  "trummor": "instrument",
  "trummor & percussion": "instrument",
  "drums": "instrument",
  "piano": "instrument",
  "keyboards": "instrument",
  "keyboard": "instrument",
  "klaviatur": "instrument",
  "klaviatur, övrig": "instrument",
  "blåsinstrument": "instrument",
  "stråkinstrument": "instrument",
  "ukulele": "instrument",
  
  // Amplifiers - Swedish
  "förstärkare": "amplifiers",
  "forstarkare": "amplifiers",
  "gitarrförstärkare": "amplifiers",
  "basförstärkare": "amplifiers",
  "övriga förstärkare": "amplifiers",
  "amp": "amplifiers",
  "amps": "amplifiers",
  
  // Pedals & Effects - Swedish
  "pedaler": "pedals-effects",
  "pedaler & effekter": "pedals-effects",
  "effekter": "pedals-effects",
  "effects": "pedals-effects",
  
  // Studio - Swedish
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
  "api & 500-series": "studio",
  "studiomöbler": "studio",
  
  // DJ & Live - Swedish
  "dj": "dj-live",
  "dj-utrustning": "dj-live",
  "pa": "dj-live",
  "pa & live": "dj-live",
  "live": "dj-live",
  "scen": "dj-live",
  "ljus": "dj-live",
  "lighting": "dj-live",
  
  // Synth & Modular - Swedish
  "synthar": "synth-modular",
  "synth": "synth-modular",
  "synthesizer": "synth-modular",
  "eurorack": "synth-modular",
  "modular": "synth-modular",
  
  // Software & Computers - Swedish
  "mjukvara": "software-computers",
  "mjukvara & plug-ins": "software-computers",
  "plugins": "software-computers",
  "plug-ins": "software-computers",
  "datorer": "software-computers",
  "dator": "software-computers",
  "computer": "software-computers",
  
  // Accessories & Parts - Swedish
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
  "reservdelar & övrigt": "accessories-parts",
  
  // Services - Swedish
  "lektioner": "services",
  "lessons": "services",
  "replokaler": "services",
  "studiolokaler": "services",
  "rehearsal": "services",
  "reparation": "services",
  "repair": "services",
  "service & reparation": "services",
  
  // Other / fallback
  "övrigt": "other",
  "other": "other",
  "litteratur & noter": "other",
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
  if (category) return category.label;
  if (categoryId === "instrument") return "Instrument";
  return "Övrigt";
}
