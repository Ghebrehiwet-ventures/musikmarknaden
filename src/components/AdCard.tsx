import { MapPin } from "lucide-react";
import { Ad } from "@/lib/api";
import { cn } from "@/lib/utils";

interface AdCardProps {
  ad: Ad;
  onClick: () => void;
  index: number;
  onHoverStart?: () => void;
  onHoverEnd?: () => void;
}

export function AdCard({ ad, onClick, index, onHoverStart, onHoverEnd }: AdCardProps) {
  return (
    <article 
      onClick={onClick}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      onTouchStart={onHoverStart}
      className={cn(
        "group cursor-pointer rounded-xl overflow-hidden bg-card border border-border/50 shadow-card transition-all duration-300 hover:shadow-card-hover hover:border-primary/30 hover:-translate-y-1",
        "animate-fade-up"
      )}
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className="aspect-[4/3] relative overflow-hidden bg-secondary">
        <img 
          src={ad.image_url}
          alt={ad.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        {ad.category && (
          <span className="absolute top-2 left-2 bg-primary/90 text-primary-foreground text-xs px-2 py-1 rounded-md">
            {ad.category}
          </span>
        )}
      </div>
      
      <div className="p-4">
        <h3 className="font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
          {ad.title}
        </h3>
        
        <p className="mt-2 text-xl font-bold text-primary">
          {ad.price_text || "Pris ej angivet"}
        </p>
        
        <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4" />
            <span>{ad.location}</span>
          </div>
        </div>
      </div>
    </article>
  );
}
