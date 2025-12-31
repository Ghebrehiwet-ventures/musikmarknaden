import { Button } from "./ui/button";
import { ThemeToggle } from "./ThemeToggle";

export function Header() {
  return (
    <header className="border-b border-border bg-background">
      <div className="container flex h-10 items-center">
        <a href="/" className="font-medium text-sm">
          GearMarket
        </a>

        <div className="flex items-center gap-3 ml-auto text-sm">
          <ThemeToggle />
          <a href="/" className="text-muted-foreground hover:text-foreground">
            Logga in
          </a>
          <span className="text-border">|</span>
          <a href="/" className="hover:text-muted-foreground">
            Lägg upp annons
          </a>
        </div>
      </div>
    </header>
  );
}
