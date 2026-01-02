import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { CategoryBar } from "@/components/CategoryBar";
import { AdGrid } from "@/components/AdGrid";
import { AdList } from "@/components/AdList";
import { AdDetailModal } from "@/components/AdDetailModal";
import { Pagination } from "@/components/Pagination";
import { ViewToggle, ViewMode } from "@/components/ViewToggle";
import { SortSelect, SortOption } from "@/components/SortSelect";
import { fetchAdListings, Ad } from "@/lib/api";
import { usePrefetchAdDetails } from "@/hooks/usePrefetchAdDetails";
import { Filters } from "@/components/SearchDropdown";

export default function Index() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortOption, setSortOption] = useState<SortOption>("newest");
  const [advancedFilters, setAdvancedFilters] = useState<Filters>({
    minPrice: null,
    maxPrice: null,
    location: "",
  });
  
  const { startHoverPrefetch, cancelHoverPrefetch } = usePrefetchAdDetails();

  const { data, isLoading } = useQuery({
    queryKey: ['ads'],
    queryFn: () => fetchAdListings(),
    retry: 1,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const allAds = data?.ads || [];
  
  const filteredAndSortedAds = useMemo(() => {
    const filtered = allAds.filter(ad => {
      const searchLower = searchQuery.toLowerCase().trim();
      const matchesSearchQuery = !searchLower || 
        ad.title.toLowerCase().includes(searchLower) ||
        ad.location.toLowerCase().includes(searchLower) ||
        (ad.price_text?.toLowerCase().includes(searchLower));
      
      const matchesCat = !selectedCategory || ad.category === selectedCategory;
      
      // Advanced filters
      const matchesMinPrice = advancedFilters.minPrice === null || 
        (ad.price_amount !== null && ad.price_amount >= advancedFilters.minPrice);
      const matchesMaxPrice = advancedFilters.maxPrice === null || 
        (ad.price_amount !== null && ad.price_amount <= advancedFilters.maxPrice);
      const matchesLocation = !advancedFilters.location || 
        ad.location.toLowerCase().includes(advancedFilters.location.toLowerCase());
      
      return matchesSearchQuery && matchesCat && matchesMinPrice && matchesMaxPrice && matchesLocation;
    });

    // Sort the filtered results
    return [...filtered].sort((a, b) => {
      switch (sortOption) {
        case "price-asc":
          return (a.price_amount ?? Infinity) - (b.price_amount ?? Infinity);
        case "price-desc":
          return (b.price_amount ?? 0) - (a.price_amount ?? 0);
        case "newest":
        default:
          return 0; // Already sorted by date from API
      }
    });
  }, [allAds, searchQuery, selectedCategory, sortOption, advancedFilters]);

  const totalAds = filteredAndSortedAds.length;
  const perPage = 24;
  const totalPages = Math.max(1, Math.ceil(totalAds / perPage));
  
  const paginatedAds = useMemo(() => {
    const start = (currentPage - 1) * perPage;
    return filteredAndSortedAds.slice(start, start + perPage);
  }, [filteredAndSortedAds, currentPage, perPage]);

  const handleAdClick = (ad: Ad) => {
    setSelectedAd(ad);
    setIsModalOpen(true);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  const handleCategoryChange = (category: string | null) => {
    setSelectedCategory(category);
    setCurrentPage(1);
  };

  const handleAdvancedFiltersChange = (filters: Filters) => {
    setAdvancedFilters(filters);
    setCurrentPage(1);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <Header 
          onCategorySelect={handleCategoryChange} 
          searchQuery={searchQuery}
          onSearch={handleSearch}
          filters={advancedFilters}
          onFiltersChange={handleAdvancedFiltersChange}
        />
      </div>
      
      <CategoryBar
        selectedCategory={selectedCategory}
        onCategoryChange={handleCategoryChange}
      />
      
      <main className="max-w-[1000px] mx-auto px-4 py-3">
        <div className="flex items-center justify-between mb-2 text-sm text-muted-foreground">
          <span>{totalAds} annonser{searchQuery && ` för "${searchQuery}"`}</span>
          <div className="flex items-center gap-2">
            <SortSelect value={sortOption} onChange={setSortOption} />
            <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
          </div>
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

        {!isLoading && filteredAndSortedAds.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              Inga annonser hittades{searchQuery && ` för "${searchQuery}"`}
            </p>
            <button 
              onClick={() => { setSearchQuery(""); setSelectedCategory(null); }}
              className="mt-2 text-sm text-primary hover:underline"
            >
              Rensa filter
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

