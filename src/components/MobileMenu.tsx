import { useState, useEffect } from "react";
import { Menu, X, ChevronRight, Music } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CATEGORIES, ALL_CATEGORY_ICON } from "@/lib/categories";
import { fetchAdListings } from "@/lib/api";

interface MobileMenuProps {
  onCategorySelect?: (categoryId: string | null) => void;
}

export function MobileMenu({ onCategorySelect }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ['ads'],
    queryFn: () => fetchAdListings(),
    staleTime: 5 * 60 * 1000,
  });

  // Count ads per category
  const categoryCounts = (data?.ads || []).reduce((acc, ad) => {
    const cat = ad.category || 'other';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalAds = data?.ads?.length || 0;

  const handleCategoryClick = (categoryId: string | null) => {
    onCategorySelect?.(categoryId);
    setIsOpen(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Menu className="h-4 w-4" />
          <span className="sr-only">Öppna meny</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[300px] sm:w-[350px] p-0">
        <SheetHeader className="p-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Music className="h-4 w-4" />
            Musikmarknaden
          </SheetTitle>
        </SheetHeader>

        <div className="overflow-y-auto h-[calc(100vh-60px)]">
          {/* Navigation links */}
          <div className="p-4 space-y-2">
            <Link
              to="/"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-between py-2 text-sm hover:text-primary transition-colors"
            >
              <span>Startsida</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <Link
              to="/search"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-between py-2 text-sm hover:text-primary transition-colors"
            >
              <span>Avancerad sökning</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </div>

          <Separator />

          {/* Categories */}
          <div className="p-4">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Kategorier
            </h3>
            <div className="space-y-1">
              {/* All categories */}
              <button
                onClick={() => handleCategoryClick(null)}
                className="flex items-center justify-between w-full py-2.5 px-2 rounded-md text-sm hover:bg-accent transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <ALL_CATEGORY_ICON className="h-4 w-4 text-muted-foreground" />
                  <span>Alla kategorier</span>
                </span>
                <Badge variant="secondary" className="text-xs font-normal">
                  {totalAds}
                </Badge>
              </button>

              {CATEGORIES.map((category) => {
                const Icon = category.icon;
                const count = categoryCounts[category.id] || 0;
                
                return (
                  <button
                    key={category.id}
                    onClick={() => handleCategoryClick(category.id)}
                    className="flex items-center justify-between w-full py-2.5 px-2 rounded-md text-sm hover:bg-accent transition-colors"
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span>{category.label}</span>
                    </span>
                    <Badge variant="secondary" className="text-xs font-normal">
                      {count}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Account links */}
          <div className="p-4 space-y-2">
            <Link
              to="/"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-between py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>Logga in</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
            <Link
              to="/"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-between py-2 text-sm hover:text-primary transition-colors"
            >
              <span>Lägg upp annons</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
