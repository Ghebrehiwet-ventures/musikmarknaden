import { Search } from "lucide-react";
import { Button } from "./ui/button";
import { ThemeToggle } from "./ThemeToggle";

interface HeaderProps {
  searchQuery?: string;
  onSearch?: (query: string) => void;
}

export function Header({ searchQuery = "", onSearch }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card">
      <div className="container flex h-12 items-center gap-3">
        <a href="/" className="font-semibold text-sm shrink-0">
          GearMarket
        </a>
        
        {onSearch && (
          <div className="relative w-48 sm:w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input 
              type="text"
              placeholder="Sök..."
              className="w-full h-8 pl-8 pr-3 text-sm bg-muted border-0 rounded focus:outline-none focus:ring-1 focus:ring-ring"
              defaultValue={searchQuery}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onSearch(e.currentTarget.value);
                }
              }}
            />
          </div>
        )}

        <div className="flex items-center gap-2 ml-auto">
          <ThemeToggle />
          <Button variant="ghost" size="sm" className="h-8 text-xs">Logga in</Button>
          <Button size="sm" className="h-8 text-xs">Sälj</Button>
        </div>
      </div>
    </header>
  );
}
