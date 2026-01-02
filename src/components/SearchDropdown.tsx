import { useState, useRef, useEffect } from "react";
import { Search, Clock, TrendingUp, X, SlidersHorizontal, ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRecentSearches } from "@/hooks/useRecentSearches";
import { POPULAR_BRANDS, POPULAR_PRODUCT_TYPES } from "@/lib/popularSearches";

export interface Filters {
  minPrice: number | null;
  maxPrice: number | null;
  location: string;
}

interface SearchDropdownProps {
  searchQuery: string;
  onSearch: (query: string) => void;
  onSubmit?: (query: string) => void;
  className?: string;
  compact?: boolean;
  filters?: Filters;
  onFiltersChange?: (filters: Filters) => void;
}

export function SearchDropdown({ 
  searchQuery, 
  onSearch, 
  onSubmit, 
  className, 
  compact,
  filters = { minPrice: null, maxPrice: null, location: "" },
  onFiltersChange,
}: SearchDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [minPriceInput, setMinPriceInput] = useState(filters.minPrice?.toString() || "");
  const [maxPriceInput, setMaxPriceInput] = useState(filters.maxPrice?.toString() || "");
  const [locationInput, setLocationInput] = useState(filters.location);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { recentSearches, addRecentSearch, clearRecentSearches } = useRecentSearches();

  const activeFilterCount = [
    filters.minPrice !== null,
    filters.maxPrice !== null,
    filters.location.trim() !== "",
  ].filter(Boolean).length;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const handleSearchClick = (term: string) => {
    onSearch(term);
    addRecentSearch(term);
    setIsOpen(false);
    onSubmit?.(term);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSearch(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      addRecentSearch(searchQuery);
      setIsOpen(false);
      onSubmit?.(searchQuery);
    }
  };

  const handleClear = () => {
    onSearch("");
    inputRef.current?.focus();
  };

  const applyFilters = () => {
    onFiltersChange?.({
      minPrice: minPriceInput ? parseInt(minPriceInput, 10) : null,
      maxPrice: maxPriceInput ? parseInt(maxPriceInput, 10) : null,
      location: locationInput.trim(),
    });
  };

  const clearFilters = () => {
    setMinPriceInput("");
    setMaxPriceInput("");
    setLocationInput("");
    onFiltersChange?.({
      minPrice: null,
      maxPrice: null,
      location: "",
    });
  };

  const handleFilterKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      applyFilters();
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className || ""}`}>
      <form onSubmit={handleSubmit}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Sök bland 1900+ annonser..."
          value={searchQuery}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          className={`pl-10 pr-9 text-sm bg-secondary/50 border-transparent hover:border-border focus:border-border focus:bg-background transition-colors rounded-full ${compact ? "h-9" : "h-10"}`}
        />
        {searchQuery && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </form>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border rounded-xl shadow-lg z-50 overflow-hidden">
          {/* Recent searches */}
          {recentSearches.length > 0 && (
            <div className="p-3 border-b border-border">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>Senaste sökningar</span>
                </div>
                <button
                  onClick={clearRecentSearches}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Rensa
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {recentSearches.map((term) => (
                  <Badge
                    key={term}
                    variant="secondary"
                    className="cursor-pointer hover:bg-secondary/80 text-xs"
                    onClick={() => handleSearchClick(term)}
                  >
                    {term}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Popular brands */}
          <div className="p-3 border-b border-border">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
              <TrendingUp className="h-3 w-3" />
              <span>Populära märken</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {POPULAR_BRANDS.map((term) => (
                <Badge
                  key={term}
                  variant="outline"
                  className="cursor-pointer hover:bg-accent text-xs"
                  onClick={() => handleSearchClick(term)}
                >
                  {term}
                </Badge>
              ))}
            </div>
          </div>

          {/* Popular product types */}
          <div className="p-3 border-b border-border">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
              <TrendingUp className="h-3 w-3" />
              <span>Populära produkter</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {POPULAR_PRODUCT_TYPES.map((term) => (
                <Badge
                  key={term}
                  variant="outline"
                  className="cursor-pointer hover:bg-accent text-xs"
                  onClick={() => handleSearchClick(term)}
                >
                  {term}
                </Badge>
              ))}
            </div>
          </div>

          {/* Advanced filters toggle */}
          <div className="border-t border-border">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center justify-between w-full p-3 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                <span>Avancerade filter</span>
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0">
                    {activeFilterCount}
                  </Badge>
                )}
              </div>
              {showFilters ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>

            {showFilters && (
              <div className="p-3 pt-0 space-y-3">
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
                      onKeyDown={handleFilterKeyDown}
                      className="h-8 text-sm"
                    />
                    <span className="text-muted-foreground text-sm">–</span>
                    <Input
                      type="number"
                      placeholder="Max"
                      value={maxPriceInput}
                      onChange={(e) => setMaxPriceInput(e.target.value)}
                      onKeyDown={handleFilterKeyDown}
                      className="h-8 text-sm"
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
                    onKeyDown={handleFilterKeyDown}
                    className="h-8 text-sm"
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1">
                  <Button onClick={applyFilters} size="sm" className="h-8 flex-1">
                    Filtrera
                  </Button>
                  {activeFilterCount > 0 && (
                    <Button
                      onClick={clearFilters}
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
