import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { AdGrid } from "@/components/AdGrid";
import { AdList } from "@/components/AdList";
import { CategoryFilter, matchesCategory } from "@/components/CategoryFilter";
import { AdDetailModal } from "@/components/AdDetailModal";
import { Pagination } from "@/components/Pagination";
import { ViewToggle, ViewMode } from "@/components/ViewToggle";
import { fetchAdListings, Ad } from "@/lib/api";
import { usePrefetchAdDetails } from "@/hooks/usePrefetchAdDetails";

export default function Index() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  
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
  
  const filteredAds = useMemo(() => {
    return allAds.filter(ad => {
      const searchLower = searchQuery.toLowerCase().trim();
      const matchesSearchQuery = !searchLower || 
        ad.title.toLowerCase().includes(searchLower) ||
        ad.location.toLowerCase().includes(searchLower) ||
        (ad.price_text?.toLowerCase().includes(searchLower));
      
      const matchesCat = matchesCategory(ad.category || '', selectedCategory);
      
      return matchesSearchQuery && matchesCat;
    });
  }, [allAds, searchQuery, selectedCategory]);

  const totalAds = filteredAds.length;
  const perPage = 30;
  const totalPages = Math.max(1, Math.ceil(totalAds / perPage));
  
  const paginatedAds = useMemo(() => {
    const start = (currentPage - 1) * perPage;
    return filteredAds.slice(start, start + perPage);
  }, [filteredAds, currentPage, perPage]);

  const handleAdClick = (ad: Ad) => {
    setSelectedAd(ad);
    setIsModalOpen(true);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header searchQuery={searchQuery} onSearch={handleSearch} />
      
      <main className="container py-4">
        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 overflow-x-auto pb-2 sm:pb-0">
            <CategoryFilter 
              selectedCategory={selectedCategory}
              onCategoryChange={(cat) => {
                setSelectedCategory(cat);
                setCurrentPage(1);
              }}
            />
          </div>
          
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-sm text-muted-foreground">
              {totalAds} annonser
            </span>
            <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
          </div>
        </div>

        {/* Listings */}
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
          <div className="text-center py-8">
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
          <div className="mt-6">
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
