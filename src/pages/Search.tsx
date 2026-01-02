import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Search, SlidersHorizontal, X, ArrowUpDown } from "lucide-react";
import { Header } from "@/components/Header";
import { AdGrid } from "@/components/AdGrid";
import { AdList } from "@/components/AdList";
import { AdDetailModal } from "@/components/AdDetailModal";
import { Pagination } from "@/components/Pagination";
import { ViewToggle, ViewMode } from "@/components/ViewToggle";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchAdListings, Ad } from "@/lib/api";
import { usePrefetchAdDetails } from "@/hooks/usePrefetchAdDetails";
import { CATEGORIES } from "@/lib/categories";

type SortOption = "latest" | "price-asc" | "price-desc";

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [selectedCategory, setSelectedCategory] = useState<string>(searchParams.get("category") || "");
  const [selectedLocation, setSelectedLocation] = useState<string>(searchParams.get("location") || "");
  const [minPrice, setMinPrice] = useState(searchParams.get("minPrice") || "");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("maxPrice") || "");
  const [sortBy, setSortBy] = useState<SortOption>((searchParams.get("sort") as SortOption) || "latest");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  
  const { startHoverPrefetch, cancelHoverPrefetch } = usePrefetchAdDetails();

  const { data, isLoading } = useQuery({
    queryKey: ['ads'],
    queryFn: () => fetchAdListings(),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const allAds = data?.ads || [];

  // Extract unique locations
  const locations = useMemo(() => {
    const locs = new Set<string>();
    allAds.forEach(ad => {
      if (ad.location && ad.location.trim()) {
        locs.add(ad.location.trim());
      }
    });
    return Array.from(locs).sort();
  }, [allAds]);

  // Filter and sort ads
  const filteredAds = useMemo(() => {
    let result = allAds.filter(ad => {
      const searchLower = searchQuery.toLowerCase().trim();
      const matchesSearch = !searchLower || 
        ad.title.toLowerCase().includes(searchLower) ||
        ad.location.toLowerCase().includes(searchLower) ||
        (ad.price_text?.toLowerCase().includes(searchLower));
      
      const matchesCategory = !selectedCategory || ad.category === selectedCategory;
      
      const matchesLocation = !selectedLocation || 
        ad.location.toLowerCase().includes(selectedLocation.toLowerCase());
      
      const priceNum = ad.price_amount || 0;
      const matchesMinPrice = !minPrice || priceNum >= parseInt(minPrice);
      const matchesMaxPrice = !maxPrice || priceNum <= parseInt(maxPrice);
      
      return matchesSearch && matchesCategory && matchesLocation && matchesMinPrice && matchesMaxPrice;
    });

    // Sort
    if (sortBy === "price-asc") {
      result.sort((a, b) => (a.price_amount || 0) - (b.price_amount || 0));
    } else if (sortBy === "price-desc") {
      result.sort((a, b) => (b.price_amount || 0) - (a.price_amount || 0));
    }
    // "latest" is default order from API

    return result;
  }, [allAds, searchQuery, selectedCategory, selectedLocation, minPrice, maxPrice, sortBy]);

  const totalAds = filteredAds.length;
  const perPage = 24;
  const totalPages = Math.max(1, Math.ceil(totalAds / perPage));
  
  const paginatedAds = useMemo(() => {
    const start = (currentPage - 1) * perPage;
    return filteredAds.slice(start, start + perPage);
  }, [filteredAds, currentPage]);

  const handleAdClick = (ad: Ad) => {
    setSelectedAd(ad);
    setIsModalOpen(true);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategory("");
    setSelectedLocation("");
    setMinPrice("");
    setMaxPrice("");
    setSortBy("latest");
    setCurrentPage(1);
    setSearchParams({});
  };

  const hasActiveFilters = searchQuery || selectedCategory || selectedLocation || minPrice || maxPrice;

  // Active filter count
  const activeFilterCount = [searchQuery, selectedCategory, selectedLocation, minPrice, maxPrice].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Search Header - Sticky */}
      <div className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="max-w-[1000px] mx-auto px-4 py-4">
          <div className="flex items-center gap-2 mb-4">
            <SlidersHorizontal className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-lg font-medium">Avancerad sökning</h1>
          </div>

          {/* Search input */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Sök efter märke, modell, instrument..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="h-11 pl-10 pr-3 text-sm"
            />
          </div>

          {/* Filters row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Category */}
            <Select value={selectedCategory} onValueChange={(v) => { setSelectedCategory(v === "all" ? "" : v); setCurrentPage(1); }}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla kategorier</SelectItem>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Location */}
            <Select value={selectedLocation} onValueChange={(v) => { setSelectedLocation(v === "all" ? "" : v); setCurrentPage(1); }}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Plats" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Hela Sverige</SelectItem>
                {locations.slice(0, 50).map(loc => (
                  <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Price range */}
            <div className="flex gap-1.5">
              <Input
                type="number"
                placeholder="Min pris"
                value={minPrice}
                onChange={(e) => { setMinPrice(e.target.value); setCurrentPage(1); }}
                className="h-10 text-sm"
              />
              <Input
                type="number"
                placeholder="Max pris"
                value={maxPrice}
                onChange={(e) => { setMaxPrice(e.target.value); setCurrentPage(1); }}
                className="h-10 text-sm"
              />
            </div>

            {/* Sort */}
            <Select value={sortBy} onValueChange={(v) => { setSortBy(v as SortOption); setCurrentPage(1); }}>
              <SelectTrigger className="h-10">
                <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="latest">Senaste först</SelectItem>
                <SelectItem value="price-asc">Pris: lågt till högt</SelectItem>
                <SelectItem value="price-desc">Pris: högt till lågt</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Active filters */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="text-xs text-muted-foreground">Filter:</span>
              {searchQuery && (
                <Badge variant="secondary" className="gap-1">
                  "{searchQuery}"
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setSearchQuery("")} />
                </Badge>
              )}
              {selectedCategory && (
                <Badge variant="secondary" className="gap-1">
                  {CATEGORIES.find(c => c.id === selectedCategory)?.label}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedCategory("")} />
                </Badge>
              )}
              {selectedLocation && (
                <Badge variant="secondary" className="gap-1">
                  {selectedLocation}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedLocation("")} />
                </Badge>
              )}
              {(minPrice || maxPrice) && (
                <Badge variant="secondary" className="gap-1">
                  {minPrice || "0"} - {maxPrice || "∞"} kr
                  <X className="h-3 w-3 cursor-pointer" onClick={() => { setMinPrice(""); setMaxPrice(""); }} />
                </Badge>
              )}
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-6 px-2">
                Rensa alla
              </Button>
            </div>
          )}
        </div>
      </div>

      <main className="max-w-[1000px] mx-auto px-4 py-3">
        <div className="flex items-center justify-between mb-2 text-sm text-muted-foreground">
          <span>{totalAds} annonser</span>
          <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
        </div>

        {viewMode === "grid" ? (
          <AdGrid 
            ads={paginatedAds} 
            isLoading={isLoading}
            onAdClick={handleAdClick}
            onAdHoverStart={startHoverPrefetch}
            onAdHoverEnd={cancelHoverPrefetch}
          />
        ) : (
          <AdList 
            ads={paginatedAds} 
            isLoading={isLoading}
            onAdClick={handleAdClick}
            onAdHoverStart={startHoverPrefetch}
            onAdHoverEnd={cancelHoverPrefetch}
          />
        )}

        {!isLoading && filteredAds.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              Inga annonser hittades med valda filter
            </p>
            <button 
              onClick={clearFilters}
              className="mt-2 text-sm text-primary hover:underline"
            >
              Rensa alla filter
            </button>
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-8">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </main>

      <AdDetailModal
        ad={selectedAd}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
      />
    </div>
  );
}
