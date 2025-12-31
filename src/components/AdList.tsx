import { Ad } from "@/lib/api";
import { MapPin, Calendar } from "lucide-react";
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
    <div className="flex flex-col gap-3">
      {ads.map((ad, index) => (
        <article
          key={ad.ad_path}
          onClick={() => onAdClick(ad)}
          onMouseEnter={() => onAdHoverStart?.(ad)}
          onMouseLeave={onAdHoverEnd}
          className="group flex gap-4 p-4 bg-card border border-border rounded-lg cursor-pointer hover:border-primary/50 hover:shadow-md transition-all duration-200"
          style={{
            animationDelay: `${index * 30}ms`,
          }}
        >
          {/* Thumbnail */}
          <div className="relative w-24 h-24 sm:w-32 sm:h-32 flex-shrink-0 overflow-hidden rounded-md bg-muted">
            <img
              src={ad.image_url || "/placeholder.svg"}
              alt={ad.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 flex flex-col justify-between">
            <div>
              {ad.category && (
                <span className="inline-block text-xs font-medium text-primary mb-1">
                  {ad.category}
                </span>
              )}
              <h3 className="font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                {ad.title}
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mt-2">
              <div className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                <span className="truncate max-w-[150px]">{ad.location}</span>
              </div>
              {ad.date && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{ad.date}</span>
                </div>
              )}
            </div>
          </div>

          {/* Price */}
          <div className="flex-shrink-0 text-right">
            <p className="font-bold text-lg text-primary whitespace-nowrap">
              {ad.price_text || "Pris ej angivet"}
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}
