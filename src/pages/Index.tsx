import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { AdGrid } from "@/components/AdGrid";
import { CategoryFilter, matchesCategory } from "@/components/CategoryFilter";
import { AdDetailModal } from "@/components/AdDetailModal";
import { Pagination } from "@/components/Pagination";
import { fetchAdListings, Ad } from "@/lib/api";
import { usePrefetchAdDetails } from "@/hooks/usePrefetchAdDetails";

export default function Index() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  const { startHoverPrefetch, cancelHoverPrefetch } = usePrefetchAdDetails();

  // Fetch all active ads from cache (no pagination at API level)
  const { data, isLoading, error } = useQuery({
    queryKey: ['ads'],
    queryFn: () => fetchAdListings(),
    retry: 1,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const allAds = data?.ads || [];
  
  // Client-side filtering for search and category
  const filteredAds = useMemo(() => {
    return allAds.filter(ad => {
      // Search filter - match title, location, or price
      const searchLower = searchQuery.toLowerCase().trim();
      const matchesSearchQuery = !searchLower || 
        ad.title.toLowerCase().includes(searchLower) ||
        ad.location.toLowerCase().includes(searchLower) ||
        (ad.price_text?.toLowerCase().includes(searchLower));
      
      // Category filter using helper function
      const matchesCat = matchesCategory(ad.category || '', selectedCategory);
      
      return matchesSearchQuery && matchesCat;
    });
  }, [allAds, searchQuery, selectedCategory]);

  const totalAds = filteredAds.length;
  const perPage = 20;
  const totalPages = Math.max(1, Math.ceil(totalAds / perPage));
  
  // Paginate filtered results
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
    setCurrentPage(1); // Reset to first page on new search
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main>
        <Hero onSearch={handleSearch} />
        
        <section className="container py-12">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl font-bold">Bläddra bland utrustning</h2>
              <p className="text-muted-foreground mt-1">
                {totalAds} annonser tillgängliga
              </p>
            </div>
            
            <CategoryFilter 
              selectedCategory={selectedCategory}
              onCategoryChange={(cat) => {
                setSelectedCategory(cat);
                setCurrentPage(1);
              }}
            />
          </div>

          <AdGrid 
            ads={paginatedAds} 
            isLoading={isLoading}
            onAdClick={handleAdClick}
            onAdHoverStart={startHoverPrefetch}
            onAdHoverEnd={cancelHoverPrefetch}
          />

          {!isLoading && filteredAds.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-lg">
                Inga annonser hittades{searchQuery && ` för "${searchQuery}"`}
                {selectedCategory && ` i kategorin "${selectedCategory}"`}
              </p>
              <button 
                onClick={() => { setSearchQuery(""); setSelectedCategory(null); }}
                className="mt-4 text-primary hover:underline"
              >
                Rensa filter
              </button>
            </div>
          )}

          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          )}
        </section>
      </main>

      <AdDetailModal
        ad={selectedAd}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
      />

      <footer className="border-t border-border/50 py-8 mt-12">
        <div className="container text-center text-sm text-muted-foreground">
          <p>© 2024 GearMarket. Din marknadsplats för musikutrustning.</p>
        </div>
      </footer>
    </div>
  );
}
