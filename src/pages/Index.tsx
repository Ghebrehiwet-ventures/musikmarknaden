import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { CategoryBar } from "@/components/CategoryBar";
import { AdGrid } from "@/components/AdGrid";
import { AdList } from "@/components/AdList";
import { Pagination } from "@/components/Pagination";
import { ViewToggle, ViewMode } from "@/components/ViewToggle";
import { SortSelect, SortOption } from "@/components/SortSelect";
import { SourceFilter } from "@/components/SourceFilter";
import { fetchAdListings, Ad } from "@/lib/api";
import { usePrefetchAdDetails } from "@/hooks/usePrefetchAdDetails";

export default function Index() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryFromUrl = searchParams.get("category");
  
  const [selectedCategory, setSelectedCategory] = useState<string | null>(categoryFromUrl);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortOption, setSortOption] = useState<SortOption>("relevance");
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  
  // Sync category from URL on mount and URL changes
  useEffect(() => {
    setSelectedCategory(categoryFromUrl);
  }, [categoryFromUrl]);
  
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

  // Get unique sources for the filter
  const availableSources = useMemo(() => {
    const sources = new Set<string>();
    allAds.forEach(ad => {
      if (ad.source_name) sources.add(ad.source_name);
    });
    return Array.from(sources).sort((a, b) => a.localeCompare(b, 'sv'));
  }, [allAds]);
  
  // Parse Swedish price format: "1.199 kr" -> 1199
  const parsePriceFromText = (priceText: string | null): number | null => {
    if (!priceText) return null;
    const cleaned = priceText.replace(/\s*kr\s*/gi, '').replace(/\./g, '').replace(/\s/g, '').trim();
    const num = parseInt(cleaned, 10);
    return isNaN(num) ? null : num;
  };

  const filteredAndSortedAds = useMemo(() => {
    const filtered = allAds.filter(ad => {
      const searchLower = searchQuery.toLowerCase().trim();
      const matchesSearchQuery = !searchLower || 
        ad.title.toLowerCase().includes(searchLower) ||
        ad.location.toLowerCase().includes(searchLower) ||
        (ad.price_text?.toLowerCase().includes(searchLower));
      
      const matchesCat = !selectedCategory || ad.category === selectedCategory;
      const matchesSource = !selectedSource || ad.source_name === selectedSource;
      
      return matchesSearchQuery && matchesCat && matchesSource;
    });

    return [...filtered].sort((a, b) => {
      switch (sortOption) {
        case "price-asc": {
          const priceA = parsePriceFromText(a.price_text) ?? Infinity;
          const priceB = parsePriceFromText(b.price_text) ?? Infinity;
          return priceA - priceB;
        }
        case "price-desc": {
          const priceA = parsePriceFromText(a.price_text) ?? 0;
          const priceB = parsePriceFromText(b.price_text) ?? 0;
          return priceB - priceA;
        }
        case "newest": {
          const dateA = new Date(a.date || 0).getTime();
          const dateB = new Date(b.date || 0).getTime();
          return dateB - dateA;
        }
        case "oldest": {
          const dateA = new Date(a.date || 0).getTime();
          const dateB = new Date(b.date || 0).getTime();
          return dateA - dateB;
        }
        case "relevance":
        default:
          return 0;
      }
    });
  }, [allAds, searchQuery, selectedCategory, selectedSource, sortOption]);

  const totalAds = filteredAndSortedAds.length;
  const perPage = 24;
  const totalPages = Math.max(1, Math.ceil(totalAds / perPage));
  
  const paginatedAds = useMemo(() => {
    const start = (currentPage - 1) * perPage;
    return filteredAndSortedAds.slice(start, start + perPage);
  }, [filteredAndSortedAds, currentPage, perPage]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  const handleCategoryChange = (category: string | null) => {
    setSelectedCategory(category);
    setCurrentPage(1);
  };

  const handleSourceChange = (source: string | null) => {
    setSelectedSource(source);
    setCurrentPage(1);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <Header 
          onCategorySelect={handleCategoryChange} 
          searchQuery={searchQuery}
          onSearch={handleSearch}
        />
      </div>
      
      <CategoryBar
        selectedCategory={selectedCategory}
        onCategoryChange={handleCategoryChange}
      />
      
      <main className="max-w-6xl mx-auto px-4 lg:px-6 py-3 text-left">
        <div className="flex items-center justify-between mb-2 h-10">
          <span className="text-sm text-muted-foreground">{totalAds} annonser{searchQuery && ` för "${searchQuery}"`}</span>
          <div className="flex items-center gap-2">
            <SourceFilter value={selectedSource} onChange={handleSourceChange} sources={availableSources} />
            <SortSelect value={sortOption} onChange={setSortOption} />
            <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
          </div>
        </div>

        {viewMode === "grid" ? (
          <AdGrid 
            ads={paginatedAds} 
            isLoading={isLoading}
            onAdHoverStart={startHoverPrefetch}
            onAdHoverEnd={cancelHoverPrefetch}
          />
        ) : (
          <AdList 
            ads={paginatedAds} 
            isLoading={isLoading}
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
    </div>
  );
}

