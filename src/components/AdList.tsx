import { Ad } from "@/lib/api";
import { MapPin } from "lucide-react";
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
    <div className="flex flex-col divide-y divide-border border border-border rounded-md bg-card">
      {ads.map((ad) => (
        <article
          key={ad.ad_path}
          onClick={() => onAdClick(ad)}
          onMouseEnter={() => onAdHoverStart?.(ad)}
          onMouseLeave={onAdHoverEnd}
          className="flex gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors"
        >
          <div className="w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 overflow-hidden rounded bg-muted">
            <img
              src={ad.image_url || "/placeholder.svg"}
              alt={ad.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>

          <div className="flex-1 min-w-0 flex flex-col">
            <h3 className="text-sm font-medium text-foreground line-clamp-2">
              {ad.title}
            </h3>
            
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <MapPin className="h-3 w-3" />
              <span className="truncate">{ad.location}</span>
              {ad.date && (
                <>
                  <span className="mx-1">·</span>
                  <span>{ad.date}</span>
                </>
              )}
            </div>

            {ad.category && (
              <span className="text-xs text-muted-foreground mt-auto">
                {ad.category}
              </span>
            )}
          </div>

          <div className="flex-shrink-0">
            <p className="font-bold text-primary whitespace-nowrap">
              {ad.price_text || "—"}
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}
