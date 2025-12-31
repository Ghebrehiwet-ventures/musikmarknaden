import { CATEGORIES } from "@/lib/categories";

interface CategoryBarProps {
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
}

export function CategoryBar({ selectedCategory, onCategoryChange }: CategoryBarProps) {
  return (
    <div className="border-b border-border py-2">
      <div className="max-w-[1000px] mx-auto px-4 overflow-x-auto scrollbar-hide">
        <div className="flex items-center gap-6 whitespace-nowrap text-sm w-max">
          <button
            onClick={() => onCategoryChange(null)}
            className={`shrink-0 ${
              selectedCategory === null
                ? "text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Alla
          </button>

          {CATEGORIES.map((category) => {
            const isSelected = selectedCategory === category.id;
            
            return (
              <button
                key={category.id}
                onClick={() => onCategoryChange(isSelected ? null : category.id)}
                className={`shrink-0 ${
                  isSelected
                    ? "text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {category.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
