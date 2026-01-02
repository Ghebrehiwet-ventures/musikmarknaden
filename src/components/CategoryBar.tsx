import { useRef, useState, useEffect } from "react";
import { CATEGORIES } from "@/lib/categories";

interface CategoryBarProps {
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
}

export function CategoryBar({ selectedCategory, onCategoryChange }: CategoryBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // Drag-to-scroll handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  // Wheel-to-horizontal scroll
  const handleWheel = (e: React.WheelEvent) => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const hasOverflow = container.scrollWidth > container.clientWidth;
    
    if (hasOverflow && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      container.scrollLeft += e.deltaY;
    }
  };

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const wheelHandler = (e: WheelEvent) => {
      const hasOverflow = container.scrollWidth > container.clientWidth;
      if (hasOverflow && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        container.scrollLeft += e.deltaY;
      }
    };

    container.addEventListener("wheel", wheelHandler, { passive: false });
    return () => container.removeEventListener("wheel", wheelHandler);
  }, []);

  return (
    <div className="border-b border-border py-2">
      <div className="max-w-[1000px] mx-auto px-4">
        <div
          ref={scrollRef}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className={`flex items-center gap-6 overflow-x-auto overflow-y-hidden whitespace-nowrap text-sm scrollbar-hide touch-pan-x select-none ${
            isDragging ? "cursor-grabbing" : "cursor-grab"
          }`}
        >
          <button
            onClick={() => onCategoryChange(null)}
            className={`shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm ${
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
                className={`shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm ${
                  isSelected
                    ? "text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {category.label}
              </button>
            );
          })}

          {/* Trailing spacer to ensure last item is fully visible */}
          <span className="w-6 shrink-0" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
