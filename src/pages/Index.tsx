import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { AdGrid } from "@/components/AdGrid";
import { CategoryFilter } from "@/components/CategoryFilter";
import { AdDetailModal } from "@/components/AdDetailModal";
import { Pagination } from "@/components/Pagination";
import { fetchAdListings, Ad } from "@/lib/api";

// Mock data for demonstration
const mockAds: Ad[] = [
  { ad_id: "1001", title: "Fender Stratocaster American Pro II", price: "18,500 SEK", location: "Stockholm" },
  { ad_id: "1002", title: "Roland Jupiter-X Synthesizer", price: "24,000 SEK", location: "Gothenburg" },
  { ad_id: "1003", title: "Pearl Export EXX Drum Kit", price: "8,900 SEK", location: "Malmö" },
  { ad_id: "1004", title: "Shure SM58 Dynamic Microphone", price: "950 SEK", location: "Uppsala" },
  { ad_id: "1005", title: "Marshall JCM800 Tube Amp", price: "15,000 SEK", location: "Lund" },
  { ad_id: "1006", title: "Gibson Les Paul Standard '50s", price: "28,500 SEK", location: "Stockholm" },
  { ad_id: "1007", title: "Korg Minilogue XD", price: "6,500 SEK", location: "Västerås" },
  { ad_id: "1008", title: "Zildjian A Custom Cymbal Pack", price: "12,000 SEK", location: "Örebro" },
  { ad_id: "1009", title: "Focusrite Scarlett 2i2 Interface", price: "1,500 SEK", location: "Linköping" },
  { ad_id: "1010", title: "Boss Katana 100W Amp", price: "4,200 SEK", location: "Helsingborg" },
  { ad_id: "1011", title: "Yamaha HS8 Studio Monitors (Pair)", price: "5,800 SEK", location: "Norrköping" },
  { ad_id: "1012", title: "Rickenbacker 4003 Bass", price: "22,000 SEK", location: "Jönköping" },
];

export default function Index() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Try to fetch from API, fall back to mock data
  const { data, isLoading, error } = useQuery({
    queryKey: ['ads', selectedCategory, currentPage],
    queryFn: () => fetchAdListings(selectedCategory ?? undefined, currentPage),
    retry: 1,
  });

  // Use mock data if API fails or while loading
  const ads = data?.ads || mockAds;
  const totalAds = data?.total_ads || mockAds.length;
  const perPage = data?.per_page || 12;
  const totalPages = Math.ceil(totalAds / perPage);

  const handleAdClick = (ad: Ad) => {
    setSelectedAd(ad);
    setIsModalOpen(true);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    // In a real app, this would filter or search the API
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
              <h2 className="text-2xl font-bold">Browse Gear</h2>
              <p className="text-muted-foreground mt-1">
                {totalAds} listings available
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

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </section>
      </main>

      <AdDetailModal
        ad={selectedAd}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
      />

      <footer className="border-t border-border/50 py-8 mt-12">
        <div className="container text-center text-sm text-muted-foreground">
          <p>© 2024 GearMarket. Your marketplace for music gear.</p>
        </div>
      </footer>
    </div>
  );
}
