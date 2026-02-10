import { Link } from "react-router-dom";
import { Ad } from "@/lib/api";

interface AdCardProps {
  ad: Ad;
  onHoverStart?: () => void;
  onHoverEnd?: () => void;
}

export function AdCard({ ad, onHoverStart, onHoverEnd }: AdCardProps) {
  return (
    <Link
      to={`/ad/${encodeURIComponent(ad.ad_url)}`}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      className="block border border-border hover:border-foreground/30 transition-colors"
    >
      <div className="aspect-square bg-muted">
        <img 
          src={ad.image_url && ad.image_url.trim() !== "" ? ad.image_url : "/placeholder.svg"}
          alt={ad.title}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.src = "/placeholder.svg";
          }}
        />
      </div>
      
      <div className="p-2">
        <p className="font-bold text-foreground">
          {ad.price_text || (ad.price_amount ? `${ad.price_amount} kr` : "Pris ej angivet")}
        </p>
        
        <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
          {ad.title}
        </p>
        
        <p className="text-xs text-muted-foreground mt-1">
          {ad.location}{ad.date && ` · ${ad.date}`}
        </p>
      </div>
    </Link>
  );
}
