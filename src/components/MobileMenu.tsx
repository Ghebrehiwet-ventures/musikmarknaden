import { useState, useEffect } from "react";
import { Menu, ChevronRight, Guitar } from "lucide-react";
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
      <SheetContent side="left" className="w-[300px] sm:w-[350px] p-0 flex flex-col h-full">
        <SheetHeader className="p-4 border-b border-border flex-shrink-0">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Guitar className="h-4 w-4" />
            Musikmarknaden
          </SheetTitle>
        </SheetHeader>

        <div className="overflow-y-auto flex-1 pb-safe">
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

              {CATEGORIES.filter(category => (categoryCounts[category.id] || 0) > 0).map((category) => {
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

          {/* Future: Login and "Lägg upp annons" links will be added here when UGC is implemented */}
        </div>
      </SheetContent>
    </Sheet>
  );
}
