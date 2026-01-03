import { Ad } from "@/lib/api";
import { AdCard } from "./AdCard";
import { Loader2 } from "lucide-react";

interface AdGridProps {
  ads: Ad[];
  isLoading: boolean;
  onAdHoverStart?: (ad: Ad) => void;
  onAdHoverEnd?: () => void;
}

export function AdGrid({ ads, isLoading, onAdHoverStart, onAdHoverEnd }: AdGridProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (ads.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Inga annonser hittades.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {ads.map((ad) => (
        <AdCard 
          key={ad.ad_path} 
          ad={ad} 
          onHoverStart={() => onAdHoverStart?.(ad)}
          onHoverEnd={onAdHoverEnd}
        />
      ))}
    </div>
  );
}
