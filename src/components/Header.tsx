import { Music } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { MobileMenu } from "./MobileMenu";
import { SearchDropdown } from "./SearchDropdown";
import { Badge } from "./ui/badge";

interface HeaderProps {
  onCategorySelect?: (categoryId: string | null) => void;
  searchQuery?: string;
  onSearch?: (query: string) => void;
  totalAds?: number;
}

export function Header({ onCategorySelect, searchQuery = "", onSearch, totalAds }: HeaderProps) {
  const handleSearch = (query: string) => {
    onSearch?.(query);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background bg-background/95 backdrop-blur">
      {/* Main header row */}
      <div className="max-w-6xl mx-auto px-4 lg:px-6 flex h-14 items-center gap-4">
        {/* Left: Hamburger + Logo */}
        <div className="flex items-center gap-3">
          <MobileMenu onCategorySelect={onCategorySelect} />
          <a href="/" className="flex items-center gap-2 font-semibold text-sm hover:text-muted-foreground transition-colors">
            <Music className="h-5 w-5" />
            <span className="hidden sm:inline">Musikmarknaden.com</span>
            <Badge variant="secondary" className="text-[10px] font-medium px-1.5 py-0 h-4 bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border-amber-500/30">
              Beta
            </Badge>
          </a>
        </div>

        {/* Center: Search bar (desktop only) */}
        <div className="hidden md:flex flex-1 justify-center px-4">
          <SearchDropdown 
            searchQuery={searchQuery} 
            onSearch={handleSearch}
            className="w-full max-w-md"
            compact
            totalAds={totalAds}
          />
        </div>

        {/* Right: Icons */}
        <div className="flex items-center gap-1 ml-auto">
          <ThemeToggle />
          
          {/* Future: Login and "Sälj" buttons will be added here when UGC is implemented */}
        </div>
      </div>

      {/* Mobile search row */}
      <div className="md:hidden border-t border-border px-4 py-2">
        <SearchDropdown 
          searchQuery={searchQuery} 
          onSearch={handleSearch}
          className="w-full"
          totalAds={totalAds}
        />
      </div>
    </header>
  );
}
