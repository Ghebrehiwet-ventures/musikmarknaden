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
      className="cursor-pointer border border-border hover:border-foreground/30 transition-colors"
    >
      <div className="aspect-square bg-muted">
        <img 
          src={ad.image_url || "/placeholder.svg"}
          alt={ad.title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
      
      <div className="p-2">
        <p className="font-bold text-foreground">
          {ad.price_text && ad.price_amount !== null ? ad.price_text : "Pris ej angivet"}
        </p>
        
        <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
          {ad.title}
        </p>
        
        <p className="text-xs text-muted-foreground mt-1">
          {ad.location}{ad.date && ` · ${ad.date}`}
        </p>
      </div>
    </article>
  );
}
