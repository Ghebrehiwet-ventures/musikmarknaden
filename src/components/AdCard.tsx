import { MapPin } from "lucide-react";
import { Ad } from "@/lib/api";

interface AdCardProps {
  ad: Ad;
  onClick: () => void;
  index: number;
  onHoverStart?: () => void;
  onHoverEnd?: () => void;
}

export function AdCard({ ad, onClick, onHoverStart, onHoverEnd }: AdCardProps) {
  return (
    <article 
      onClick={onClick}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      className="group cursor-pointer bg-card border border-border rounded overflow-hidden hover:border-foreground/20 transition-colors"
    >
      <div className="aspect-[4/3] relative overflow-hidden bg-muted">
        <img 
          src={ad.image_url || "/placeholder.svg"}
          alt={ad.title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
      
      <div className="p-2.5">
        <p className="font-semibold text-sm">
          {ad.price_text || "Kontakta säljare"}
        </p>
        
        <h3 className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
          {ad.title}
        </h3>
        
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1.5">
          <MapPin className="h-3 w-3" />
          <span className="truncate">{ad.location}</span>
          {ad.date && (
            <>
              <span className="mx-0.5">·</span>
              <span>{ad.date}</span>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
