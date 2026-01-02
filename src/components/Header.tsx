import { Music } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { MobileMenu } from "./MobileMenu";

interface HeaderProps {
  onCategorySelect?: (categoryId: string | null) => void;
}

export function Header({ onCategorySelect }: HeaderProps) {
  return (
    <header className="border-b border-border bg-background">
      <div className="max-w-[1000px] mx-auto px-4 flex h-10 items-center">
        <div className="flex items-center gap-2">
          <MobileMenu onCategorySelect={onCategorySelect} />
          <a href="/" className="flex items-center gap-1.5 font-medium text-sm hover:text-muted-foreground transition-colors">
            <Music className="h-4 w-4" />
            <span className="hidden sm:inline">Musikmarknaden</span>
          </a>
        </div>

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
