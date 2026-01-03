import { Guitar, User, PlusCircle } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { MobileMenu } from "./MobileMenu";
import { SearchDropdown } from "./SearchDropdown";

interface HeaderProps {
  onCategorySelect?: (categoryId: string | null) => void;
  searchQuery?: string;
  onSearch?: (query: string) => void;
}

export function Header({ onCategorySelect, searchQuery = "", onSearch }: HeaderProps) {
  const handleSearch = (query: string) => {
    onSearch?.(query);
  };

  return (
    <header className="border-b border-border bg-background">
      {/* Main header row */}
      <div className="max-w-6xl mx-auto px-4 lg:px-6 flex h-14 items-center gap-4">
        {/* Left: Hamburger + Logo */}
        <div className="flex items-center gap-3">
          <MobileMenu onCategorySelect={onCategorySelect} />
          <a href="/" className="flex items-center gap-2 font-semibold text-sm hover:text-muted-foreground transition-colors">
            <Guitar className="h-5 w-5" />
            <span className="hidden sm:inline">Musikmarknaden.com</span>
          </a>
        </div>

        {/* Center: Search bar (desktop only) */}
        <div className="hidden md:flex flex-1 justify-center px-4">
          <SearchDropdown 
            searchQuery={searchQuery} 
            onSearch={handleSearch}
            className="w-full max-w-md"
            compact
          />
        </div>

        {/* Right: Icons */}
        <div className="flex items-center gap-1 ml-auto">
          <ThemeToggle />
          
          {/* User/Login */}
          <a 
            href="/" 
            className="flex items-center gap-2 p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
            title="Logga in"
          >
            <User className="h-5 w-5" strokeWidth={1.5} />
            <span className="hidden lg:inline text-sm">Logga in</span>
          </a>
          
          {/* Add listing */}
          <a 
            href="/" 
            className="flex items-center gap-2 p-2 rounded-full hover:bg-secondary/80 transition-colors"
            title="Lägg upp annons"
          >
            <PlusCircle className="h-5 w-5" strokeWidth={1.5} />
            <span className="hidden lg:inline text-sm">Sälj</span>
          </a>
        </div>
      </div>

      {/* Mobile search row */}
      <div className="md:hidden border-t border-border px-4 py-2">
        <SearchDropdown 
          searchQuery={searchQuery} 
          onSearch={handleSearch}
          className="w-full"
        />
      </div>
    </header>
  );
}
