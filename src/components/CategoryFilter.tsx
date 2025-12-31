import { cn } from "@/lib/utils";

interface CategoryFilterProps {
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
}

const categories = [
  { id: null, label: "Alla", matches: [] },
  { id: "gitarr", label: "Gitarrer", matches: ["Elgitarrer", "Akustiska gitarrer", "Basar"] },
  { id: "trummor", label: "Trummor", matches: ["Trummor & Percussion"] },
  { id: "keys", label: "Piano/Keys", matches: ["Klaviatur"] },
  { id: "mikrofon", label: "Mikrofoner", matches: ["Mikrofoner"] },
  { id: "förstärkare", label: "Förstärkare", matches: ["Gitarrförstärkare", "Basförstärkare", "Övriga förstärkare"] },
  { id: "synth", label: "Syntar", matches: ["Synthar", "Eurorack"] },
  { id: "studio", label: "Studio", matches: ["Studio & Scenutrustning", "PA & Live", "API 500-Series"] },
  { id: "mjukvara", label: "Mjukvara", matches: ["Mjukvara & Plug-ins"] },
];

export function matchesCategory(adCategory: string, filterId: string | null): boolean {
  if (!filterId) return true;
  
  const filter = categories.find(c => c.id === filterId);
  if (!filter || filter.matches.length === 0) return true;
  
  return filter.matches.some(match => 
    adCategory.toLowerCase().includes(match.toLowerCase())
  );
}

export function CategoryFilter({ selectedCategory, onCategoryChange }: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap gap-1">
      {categories.map((cat) => {
        const isSelected = selectedCategory === cat.id;
        
        return (
          <button
            key={cat.id ?? 'all'}
            onClick={() => onCategoryChange(cat.id)}
            className={cn(
              "px-3 py-1.5 text-sm rounded-md transition-colors",
              isSelected 
                ? "bg-primary text-primary-foreground" 
                : "bg-secondary text-secondary-foreground hover:bg-muted"
            )}
          >
            {cat.label}
          </button>
        );
      })}
    </div>
  );
}
