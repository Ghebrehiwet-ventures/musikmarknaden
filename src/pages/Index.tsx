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
import { SEOHead } from "@/components/SEOHead";
import { generateHomeMetaTags, generateCategoryMetaTags } from "@/lib/seo";
import { categoryMatchesFilter } from "@/lib/categories";

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

  // Get unique sources with counts for the filter (based on current category + search filter)
  const { availableSources, sourceCounts } = useMemo(() => {
    // First filter by category and search (but NOT source) to get accurate source counts
    const categoryFilteredAds = allAds.filter(ad => {
      const searchLower = searchQuery.toLowerCase().trim();
      const matchesSearchQuery = !searchLower || 
        ad.title.toLowerCase().includes(searchLower) ||
        ad.location.toLowerCase().includes(searchLower) ||
        (ad.price_text?.toLowerCase().includes(searchLower));
      
      const matchesCat = categoryMatchesFilter(ad.category, selectedCategory);
      
      return matchesSearchQuery && matchesCat;
    });
    
    // Now count sources from these filtered ads
    const counts: Record<string, number> = {};
    categoryFilteredAds.forEach(ad => {
      if (ad.source_name) {
        counts[ad.source_name] = (counts[ad.source_name] || 0) + 1;
      }
    });
    const sources = Object.keys(counts).sort((a, b) => a.localeCompare(b, 'sv'));
    return { availableSources: sources, sourceCounts: counts };
  }, [allAds, selectedCategory, searchQuery]);
  
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
      
      const matchesCat = categoryMatchesFilter(ad.category, selectedCategory);
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

  // SEO: Generate meta tags based on current view (homepage or category filter)
  const seo = selectedCategory 
    ? generateCategoryMetaTags(selectedCategory)
    : generateHomeMetaTags();

  return (
    <>
      <SEOHead {...seo} />
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
          <span className="text-sm text-muted-foreground">{totalAds} annonser{searchQuery && ` för "${searchQuery}"`}</span>
          <div className="flex items-center gap-2">
            <SourceFilter value={selectedSource} onChange={handleSourceChange} sources={availableSources} sourceCounts={sourceCounts} totalCount={filteredAndSortedAds.length} />
            <SortSelect value={sortOption} onChange={setSortOption} />
            <div className="hidden sm:block">
              <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
            </div>
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
    </>
  );
}

