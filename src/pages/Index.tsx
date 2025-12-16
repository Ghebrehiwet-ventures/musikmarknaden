import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { AdGrid } from "@/components/AdGrid";
import { CategoryFilter } from "@/components/CategoryFilter";
import { AdDetailModal } from "@/components/AdDetailModal";
import { Pagination } from "@/components/Pagination";
import { fetchAdListings, Ad } from "@/lib/api";

export default function Index() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ['ads', selectedCategory, currentPage],
    queryFn: () => fetchAdListings(selectedCategory ?? undefined, currentPage),
    retry: 1,
    staleTime: 10 * 60 * 1000, // 10 minutes - won't refetch if data is fresh
    gcTime: 30 * 60 * 1000, // 30 minutes - keep in cache
    refetchOnWindowFocus: false, // Don't refetch when tab regains focus
  });

  const ads = data?.ads || [];
  const totalAds = data?.count || 0;
  const perPage = 20;
  const totalPages = Math.max(1, Math.ceil(totalAds / perPage));

  const handleAdClick = (ad: Ad) => {
    setSelectedAd(ad);
    setIsModalOpen(true);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    console.log("Searching for:", query);
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
            ads={ads} 
            isLoading={isLoading}
            onAdClick={handleAdClick}
          />

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
