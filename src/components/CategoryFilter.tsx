import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Guitar, Drum, Piano, Mic2, Speaker, Music2 } from "lucide-react";

interface CategoryFilterProps {
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
}

const categories = [
  { id: null, label: "All", icon: Music2 },
  { id: "guitars", label: "Guitars", icon: Guitar },
  { id: "drums", label: "Drums", icon: Drum },
  { id: "keyboards", label: "Keys", icon: Piano },
  { id: "microphones", label: "Mics", icon: Mic2 },
  { id: "amplifiers", label: "Amps", icon: Speaker },
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
