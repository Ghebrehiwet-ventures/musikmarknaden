import { Search } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ThemeToggle } from "./ThemeToggle";

interface HeaderProps {
  searchQuery?: string;
  onSearch?: (query: string) => void;
}

export function Header({ searchQuery = "", onSearch }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card">
      <div className="container flex h-14 items-center gap-4">
        <a href="/" className="font-bold text-lg shrink-0">
          GearMarket
        </a>
        
        {onSearch && (
          <div className="flex-1 max-w-xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Sök bland annonser..."
                className="h-9 pl-9 bg-background"
                defaultValue={searchQuery}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onSearch(e.currentTarget.value);
                  }
                }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 ml-auto">
          <ThemeToggle />
          <Button variant="ghost" size="sm">Logga in</Button>
          <Button size="sm">Sälj</Button>
        </div>
      </div>
    </header>
  );
}
