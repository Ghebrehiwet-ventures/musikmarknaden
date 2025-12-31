import { Ad } from "@/lib/api";
import { Loader2 } from "lucide-react";

interface AdListProps {
  ads: Ad[];
  isLoading: boolean;
  onAdClick: (ad: Ad) => void;
  onAdHoverStart?: (ad: Ad) => void;
  onAdHoverEnd?: () => void;
}

export function AdList({ ads, isLoading, onAdClick, onAdHoverStart, onAdHoverEnd }: AdListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (ads.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted-foreground">Inga annonser hittades.</p>
      </div>
    );
  }

  return (
    <div className="border-t border-border">
      {ads.map((ad) => (
        <article
          key={ad.ad_path}
          onClick={() => onAdClick(ad)}
          onMouseEnter={() => onAdHoverStart?.(ad)}
          onMouseLeave={onAdHoverEnd}
          className="flex gap-3 py-3 px-1 border-b border-border cursor-pointer hover:bg-muted/30 transition-colors"
        >
          <div className="w-24 h-24 flex-shrink-0 overflow-hidden bg-muted">
            <img
              src={ad.image_url || "/placeholder.svg"}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>

          <div className="flex-1 min-w-0 py-0.5">
            <p className="font-bold text-foreground">
              {ad.price_text || "Begär pris"}
            </p>
            
            <h3 className="text-sm text-muted-foreground mt-0.5 line-clamp-2 leading-snug">
              {ad.title}
            </h3>
            
            <div className="text-xs text-muted-foreground mt-1.5">
              <span>{ad.location}</span>
              {ad.date && (
                <span className="ml-2">{ad.date}</span>
              )}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
