import { useState } from "react";
import { ChevronDown, ChevronUp, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export interface Filters {
  minPrice: number | null;
  maxPrice: number | null;
  location: string;
}

interface AdvancedFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
}

export function AdvancedFilters({ filters, onFiltersChange }: AdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [minPriceInput, setMinPriceInput] = useState(filters.minPrice?.toString() || "");
  const [maxPriceInput, setMaxPriceInput] = useState(filters.maxPrice?.toString() || "");
  const [locationInput, setLocationInput] = useState(filters.location);

  const activeFilterCount = [
    filters.minPrice !== null,
    filters.maxPrice !== null,
    filters.location.trim() !== "",
  ].filter(Boolean).length;

  const applyFilters = () => {
    onFiltersChange({
      minPrice: minPriceInput ? parseInt(minPriceInput, 10) : null,
      maxPrice: maxPriceInput ? parseInt(maxPriceInput, 10) : null,
      location: locationInput.trim(),
    });
  };

  const clearFilters = () => {
    setMinPriceInput("");
    setMaxPriceInput("");
    setLocationInput("");
    onFiltersChange({
      minPrice: null,
      maxPrice: null,
      location: "",
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      applyFilters();
    }
  };

  return (
    <div className="border-b border-border bg-background">
      <div className="max-w-[1000px] mx-auto px-4">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-full">
              <SlidersHorizontal className="h-4 w-4" />
              <span>Avancerade filter</span>
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0">
                  {activeFilterCount}
                </Badge>
              )}
              {isOpen ? (
                <ChevronUp className="h-4 w-4 ml-auto" />
              ) : (
                <ChevronDown className="h-4 w-4 ml-auto" />
              )}
            </button>
          </CollapsibleTrigger>

          <CollapsibleContent className="pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              {/* Price range */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Prisintervall (kr)
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={minPriceInput}
                    onChange={(e) => setMinPriceInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="h-9"
                  />
                  <span className="text-muted-foreground">–</span>
                  <Input
                    type="number"
                    placeholder="Max"
                    value={maxPriceInput}
                    onChange={(e) => setMaxPriceInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="h-9"
                  />
                </div>
              </div>

              {/* Location */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Plats
                </label>
                <Input
                  type="text"
                  placeholder="T.ex. Stockholm, Göteborg..."
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="h-9"
                />
              </div>

              {/* Actions */}
              <div className="flex items-end gap-2">
                <Button onClick={applyFilters} size="sm" className="h-9 flex-1">
                  Filtrera
                </Button>
                {activeFilterCount > 0 && (
                  <Button
                    onClick={clearFilters}
                    variant="ghost"
                    size="sm"
                    className="h-9 px-2"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
