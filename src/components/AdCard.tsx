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
      <div className="p-2">
        <p className="font-semibold text-foreground line-clamp-2 leading-snug">
          {ad.title}
        </p>
        
        <p className="font-bold text-foreground mt-1">
          {ad.price_text || "–"}
        </p>
      </div>
      
      <div className="aspect-[4/3] bg-muted">
        <img 
          src={ad.image_url || "/placeholder.svg"}
          alt={ad.title}
          className="w-full h-full object-cover opacity-90"
          loading="lazy"
        />
      </div>
      
      <div className="px-2 pb-2">
        <p className="text-xs text-muted-foreground">
          {ad.location}{ad.date && ` · ${ad.date}`}
        </p>
      </div>
    </article>
  );
}
