import { Ad } from "@/lib/api";
import { AdCard } from "./AdCard";
import { Loader2 } from "lucide-react";

interface AdGridProps {
  ads: Ad[];
  isLoading: boolean;
  onAdClick: (ad: Ad) => void;
}

export function AdGrid({ ads, isLoading, onAdClick }: AdGridProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (ads.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground text-lg">Inga annonser hittades. Försök med en annan sökning.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {ads.map((ad, index) => (
        <AdCard 
          key={ad.ad_path} 
          ad={ad} 
          onClick={() => onAdClick(ad)}
          index={index}
        />
      ))}
    </div>
  );
}
