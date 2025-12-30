import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Guitar, Drum, Piano, Mic2, Speaker, Music2, Radio, Headphones, Cable } from "lucide-react";

interface CategoryFilterProps {
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
}

// Categories with matching patterns for Gearloop's category names
const categories = [
  { id: null, label: "Alla", icon: Music2, matches: [] },
  { id: "gitarr", label: "Gitarrer", icon: Guitar, matches: ["Elgitarrer", "Akustiska gitarrer", "Basar"] },
  { id: "trummor", label: "Trummor", icon: Drum, matches: ["Trummor & Percussion"] },
  { id: "keys", label: "Piano/Keys", icon: Piano, matches: ["Klaviatur"] },
  { id: "mikrofon", label: "Mikrofoner", icon: Mic2, matches: ["Mikrofoner"] },
  { id: "förstärkare", label: "Förstärkare", icon: Speaker, matches: ["Gitarrförstärkare", "Basförstärkare", "Övriga förstärkare"] },
  { id: "synth", label: "Syntar", icon: Radio, matches: ["Synthar", "Eurorack"] },
  { id: "studio", label: "Studio", icon: Headphones, matches: ["Studio & Scenutrustning", "PA & Live", "API 500-Series"] },
  { id: "mjukvara", label: "Mjukvara", icon: Cable, matches: ["Mjukvara & Plug-ins"] },
];

// Helper to check if an ad's category matches a filter
export function matchesCategory(adCategory: string, filterId: string | null): boolean {
  if (!filterId) return true; // "Alla" matches everything
  
  const filter = categories.find(c => c.id === filterId);
  if (!filter || filter.matches.length === 0) return true;
  
  return filter.matches.some(match => 
    adCategory.toLowerCase().includes(match.toLowerCase())
  );
}

export function CategoryFilter({ selectedCategory, onCategoryChange }: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((cat) => {
        const Icon = cat.icon;
        const isSelected = selectedCategory === cat.id;
        
        return (
          <Button
            key={cat.id ?? 'all'}
            variant={isSelected ? "default" : "secondary"}
            size="sm"
            onClick={() => onCategoryChange(cat.id)}
            className={cn(
              "gap-2 transition-all",
              isSelected && "shadow-glow"
            )}
          >
            <Icon className="h-4 w-4" />
            {cat.label}
          </Button>
        );
      })}
    </div>
  );
}
