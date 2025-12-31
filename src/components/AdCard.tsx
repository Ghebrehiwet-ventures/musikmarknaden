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
      className="cursor-pointer bg-card border border-border hover:bg-muted/30 transition-colors"
    >
      <div className="aspect-square overflow-hidden bg-muted">
        <img 
          src={ad.image_url || "/placeholder.svg"}
          alt=""
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
      
      <div className="p-2">
        <p className="font-bold text-base text-foreground">
          {ad.price_text || "Begär pris"}
        </p>
        
        <h3 className="text-sm text-muted-foreground mt-0.5 line-clamp-2 leading-snug">
          {ad.title}
        </h3>
        
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1.5">
          <span className="truncate">{ad.location}</span>
          {ad.date && (
            <>
              <span>·</span>
              <span className="shrink-0">{ad.date}</span>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
