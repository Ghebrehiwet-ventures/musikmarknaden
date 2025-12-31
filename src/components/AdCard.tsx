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
      className="group cursor-pointer bg-card border border-border rounded-lg overflow-hidden hover:shadow-md hover:border-primary/30 transition-all"
    >
      <div className="aspect-[4/3] relative overflow-hidden bg-muted">
        <img 
          src={ad.image_url || "/placeholder.svg"}
          alt={ad.title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
      
      <div className="p-3">
        <p className="font-bold text-primary">
          {ad.price_text || "Kontakta säljare"}
        </p>
        
        <h3 className="text-sm text-foreground line-clamp-2 mt-1">
          {ad.title}
        </h3>
        
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
          <MapPin className="h-3 w-3" />
          <span className="truncate">{ad.location}</span>
          {ad.date && (
            <>
              <span className="mx-1">·</span>
              <span>{ad.date}</span>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
