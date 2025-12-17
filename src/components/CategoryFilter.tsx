import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Guitar, Drum, Piano, Mic2, Speaker, Music2, Radio } from "lucide-react";

interface CategoryFilterProps {
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
}

// Categories for client-side filtering
const categories = [
  { id: null, label: "Alla", icon: Music2 },
  { id: "gitarr", label: "Gitarrer", icon: Guitar },
  { id: "trumm", label: "Trummor", icon: Drum },
  { id: "piano", label: "Piano/Keys", icon: Piano },
  { id: "mikrofon", label: "Mikrofoner", icon: Mic2 },
  { id: "förstärkare", label: "Förstärkare", icon: Speaker },
  { id: "synth", label: "Syntar", icon: Radio },
];

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
