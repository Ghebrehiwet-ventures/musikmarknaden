import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface HeroSearchProps {
  searchQuery: string;
  onSearch: (query: string) => void;
}

export function HeroSearch({ searchQuery, onSearch }: HeroSearchProps) {
  return (
    <div className="border-b border-border py-3">
      <div className="container">
        <div className="relative max-w-md">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Sök..."
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            className="h-8 pl-8 pr-3 text-sm bg-background border-border"
          />
        </div>
      </div>
    </div>
  );
}
