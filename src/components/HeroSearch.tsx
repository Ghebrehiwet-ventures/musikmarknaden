import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface HeroSearchProps {
  searchQuery: string;
  onSearch: (query: string) => void;
}

export function HeroSearch({ searchQuery, onSearch }: HeroSearchProps) {
  return (
    <section className="bg-muted border-b border-border py-6 px-4">
      <div className="container max-w-xl mx-auto">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Sök bland tusentals annonser..."
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 bg-card text-foreground border-border"
          />
        </div>
      </div>
    </section>
  );
}
