import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface HeroSearchProps {
  searchQuery: string;
  onSearch: (query: string) => void;
}

const popularTags = [
  "Gitarr",
  "Fender",
  "Synthesizer",
  "Trummor",
  "Förstärkare",
  "Pedaler",
  "Vintage",
];

export function HeroSearch({ searchQuery, onSearch }: HeroSearchProps) {
  return (
    <section className="hero-gradient py-10 px-4">
      <div className="container max-w-2xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold text-white text-center mb-6">
          Hitta din nästa musikutrustning
        </h1>
        
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Vad letar du efter?"
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            className="w-full h-12 pl-12 pr-4 bg-card text-foreground border-0 rounded-lg text-base shadow-lg"
          />
        </div>

        <div className="flex items-center gap-2 mt-4 flex-wrap justify-center">
          <span className="text-white/80 text-sm">Populärt:</span>
          {popularTags.map((tag) => (
            <button
              key={tag}
              onClick={() => onSearch(tag)}
              className="px-3 py-1 bg-white/90 hover:bg-white text-foreground text-sm rounded-full transition-colors"
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
