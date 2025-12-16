import { Search } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

interface HeroProps {
  onSearch: (query: string) => void;
}

export function Hero({ onSearch }: HeroProps) {
  return (
    <section className="relative overflow-hidden gradient-hero py-24 md:py-32">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_hsl(35_100%_55%_/_0.1),_transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_hsl(35_90%_50%_/_0.05),_transparent_50%)]" />
      
      <div className="container relative z-10">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight md:text-6xl lg:text-7xl animate-fade-up">
            Find Your Next
            <span className="block text-gradient mt-2">Music Gear</span>
          </h1>
          
          <p className="mt-6 text-lg text-muted-foreground md:text-xl animate-fade-up" style={{ animationDelay: '0.1s' }}>
            Buy and sell guitars, synths, drums, and more. 
            The marketplace for musicians.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-3 max-w-xl mx-auto animate-fade-up" style={{ animationDelay: '0.2s' }}>
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input 
                placeholder="Search guitars, synths, drums..."
                className="h-14 pl-12 pr-4 bg-card border-border/50 text-base"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onSearch((e.target as HTMLInputElement).value);
                  }
                }}
              />
            </div>
            <Button variant="hero" size="lg" className="shrink-0">
              Search Gear
            </Button>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground animate-fade-up" style={{ animationDelay: '0.3s' }}>
            <span>Popular:</span>
            <Button variant="muted" size="sm" onClick={() => onSearch('guitar')}>Guitars</Button>
            <Button variant="muted" size="sm" onClick={() => onSearch('synthesizer')}>Synths</Button>
            <Button variant="muted" size="sm" onClick={() => onSearch('drums')}>Drums</Button>
            <Button variant="muted" size="sm" onClick={() => onSearch('amplifier')}>Amps</Button>
          </div>
        </div>
      </div>
    </section>
  );
}
