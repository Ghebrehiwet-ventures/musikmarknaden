import { 
  Guitar, 
  Piano, 
  Drum, 
  Speaker, 
  Mic2, 
  Music2, 
  Headphones, 
  Cable
} from "lucide-react";

interface Category {
  id: string;
  label: string;
  icon: React.ElementType;
}

const categories: Category[] = [
  { id: "gitarr", label: "Gitarrer", icon: Guitar },
  { id: "piano", label: "Keyboards", icon: Piano },
  { id: "trummor", label: "Trummor", icon: Drum },
  { id: "forstarkare", label: "Förstärkare", icon: Speaker },
  { id: "mikrofon", label: "Mikrofoner", icon: Mic2 },
  { id: "studio", label: "Studio", icon: Music2 },
  { id: "horlurar", label: "Hörlurar", icon: Headphones },
  { id: "tillbehor", label: "Tillbehör", icon: Cable },
];

interface CategoryBarProps {
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
}

export function CategoryBar({ selectedCategory, onCategoryChange }: CategoryBarProps) {
  return (
    <div className="border-b border-border bg-card">
      <div className="container">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide py-2 -mx-4 px-4">
          <button
            onClick={() => onCategoryChange(null)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors shrink-0 ${
              selectedCategory === null
                ? "bg-foreground text-background font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Music2 className="h-4 w-4" />
            <span>Alla</span>
          </button>

          {categories.map((category) => {
            const Icon = category.icon;
            const isSelected = selectedCategory === category.id;
            
            return (
              <button
                key={category.id}
                onClick={() => onCategoryChange(isSelected ? null : category.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors shrink-0 ${
                  isSelected
                    ? "bg-foreground text-background font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{category.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
