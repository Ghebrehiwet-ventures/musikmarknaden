interface Category {
  id: string;
  label: string;
}

const categories: Category[] = [
  { id: "gitarr", label: "Gitarrer" },
  { id: "piano", label: "Keyboards" },
  { id: "trummor", label: "Trummor" },
  { id: "forstarkare", label: "Förstärkare" },
  { id: "mikrofon", label: "Mikrofoner" },
  { id: "studio", label: "Studio" },
  { id: "horlurar", label: "Hörlurar" },
  { id: "tillbehor", label: "Tillbehör" },
];

interface CategoryBarProps {
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
}

export function CategoryBar({ selectedCategory, onCategoryChange }: CategoryBarProps) {
  return (
    <div className="border-b border-border py-2">
      <div className="max-w-[1000px] mx-auto px-4">
        <div className="flex items-center gap-4 overflow-x-auto scrollbar-hide text-sm">
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

          {categories.map((category) => {
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
