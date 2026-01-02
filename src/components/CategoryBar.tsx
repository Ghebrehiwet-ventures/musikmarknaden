import { useRef, useState, useEffect, useCallback } from "react";
import { CATEGORIES, ALL_CATEGORY_ICON } from "@/lib/categories";

interface CategoryBarProps {
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
}

export function CategoryBar({ selectedCategory, onCategoryChange }: CategoryBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  
  // Scroll indicator state
  const [scrollProgress, setScrollProgress] = useState(0);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [thumbWidth, setThumbWidth] = useState(0);

  const checkScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    const maxScroll = scrollWidth - clientWidth;
    const overflow = scrollWidth > clientWidth;
    
    setHasOverflow(overflow);
    
    if (overflow && maxScroll > 0) {
      setScrollProgress((scrollLeft / maxScroll) * 100);
      setThumbWidth((clientWidth / scrollWidth) * 100);
    } else {
      setScrollProgress(0);
      setThumbWidth(100);
    }
  }, []);

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

  const handleScroll = () => {
    checkScroll();
  };

  // Wheel-to-horizontal scroll
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

  // Check scroll on mount and resize
  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [checkScroll]);

  const AllIcon = ALL_CATEGORY_ICON;

  return (
    <div className="border-b border-border py-3">
      <div className="max-w-[1000px] mx-auto px-4">
        <div
          ref={scrollRef}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onScroll={handleScroll}
          className={`flex items-start gap-6 overflow-x-auto overflow-y-hidden whitespace-nowrap scrollbar-hide touch-pan-x select-none ${
            isDragging ? "cursor-grabbing" : "cursor-grab"
          }`}
        >
          {/* All categories button */}
          <button
            onClick={() => onCategoryChange(null)}
            className={`shrink-0 flex flex-col items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm transition-colors ${
              selectedCategory === null
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <AllIcon className="h-5 w-5" />
            <span className={`text-xs ${selectedCategory === null ? "font-medium" : ""}`}>
              Alla
            </span>
          </button>

          {CATEGORIES.map((category) => {
            const isSelected = selectedCategory === category.id;
            const Icon = category.icon;
            
            return (
              <button
                key={category.id}
                onClick={() => onCategoryChange(isSelected ? null : category.id)}
                className={`shrink-0 flex flex-col items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm transition-colors ${
                  isSelected
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className={`text-xs ${isSelected ? "font-medium" : ""}`}>
                  {category.label}
                </span>
              </button>
            );
          })}

          {/* Trailing spacer to ensure last item is fully visible */}
          <span className="w-6 shrink-0" aria-hidden="true" />
        </div>

        {/* Tradera-style scroll indicator */}
        {hasOverflow && (
          <div className="h-0.5 bg-muted rounded-full mt-3 overflow-hidden">
            <div 
              className="h-full bg-primary/60 rounded-full transition-transform duration-150 ease-out"
              style={{ 
                width: `${thumbWidth}%`,
                transform: `translateX(${(scrollProgress / 100) * ((100 / thumbWidth) - 1) * 100}%)`
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
