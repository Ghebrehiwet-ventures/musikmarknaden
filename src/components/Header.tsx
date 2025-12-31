import { Button } from "./ui/button";
import { ThemeToggle } from "./ThemeToggle";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card">
      <div className="container flex h-12 items-center gap-4">
        <a href="/" className="font-semibold text-base shrink-0">
          GearMarket
        </a>

        <nav className="hidden sm:flex items-center gap-4 ml-4">
          <a href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Så funkar det
          </a>
        </nav>

        <div className="flex items-center gap-2 ml-auto">
          <ThemeToggle />
          <Button variant="ghost" size="sm" className="h-8 text-sm">
            Logga in
          </Button>
          <Button size="sm" className="h-8 text-sm">
            Lägg upp annons
          </Button>
        </div>
      </div>
    </header>
  );
}
