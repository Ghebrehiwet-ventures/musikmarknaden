import { Music, Search } from "lucide-react";
import { Button } from "./ui/button";
import { ThemeToggle } from "./ThemeToggle";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <Music className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold tracking-tight">GearMarket</span>
        </div>
        
        <nav className="hidden md:flex items-center gap-8">
          <a href="#" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Browse
          </a>
          <a href="#" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Sell
          </a>
          <a href="#" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Categories
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button variant="ghost" size="icon">
            <Search className="h-5 w-5" />
          </Button>
          <Button variant="outline" size="sm">Sign In</Button>
          <Button size="sm">Post Ad</Button>
        </div>
      </div>
    </header>
  );
}
