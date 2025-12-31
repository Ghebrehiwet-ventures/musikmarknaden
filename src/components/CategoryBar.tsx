import { 
  Guitar, 
  Piano, 
  Drum, 
  Speaker, 
  Mic2, 
  Music2, 
  Headphones, 
  Cable,
  ChevronRight
} from "lucide-react";
import { useRef, useState } from "react";

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
    }
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 200, behavior: "smooth" });
    }
  };

  return (
    <div className="border-b border-border bg-card relative">
      <div className="container">
        <div 
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex items-center gap-1 overflow-x-auto scrollbar-hide py-3 -mx-4 px-4"
        >
          <button
            onClick={() => onCategoryChange(null)}
            className={`flex flex-col items-center gap-1.5 px-4 py-2 rounded-lg transition-colors shrink-0 min-w-[72px] ${
              selectedCategory === null
                ? "bg-primary/10 text-primary"
                : "hover:bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            <Music2 className="h-5 w-5" />
            <span className="text-xs font-medium">Alla</span>
          </button>

          {categories.map((category) => {
            const Icon = category.icon;
            const isSelected = selectedCategory === category.id;
            
            return (
              <button
                key={category.id}
                onClick={() => onCategoryChange(isSelected ? null : category.id)}
                className={`flex flex-col items-center gap-1.5 px-4 py-2 rounded-lg transition-colors shrink-0 min-w-[72px] ${
                  isSelected
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs font-medium">{category.label}</span>
              </button>
            );
          })}
        </div>

        {canScrollRight && (
          <button
            onClick={scrollRight}
            className="absolute right-0 top-1/2 -translate-y-1/2 bg-gradient-to-l from-card via-card to-transparent pl-8 pr-2 py-6 hidden md:flex items-center"
          >
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        )}
      </div>
    </div>
  );
}
