import { MapPin } from "lucide-react";
import { Ad } from "@/lib/api";
import { cn } from "@/lib/utils";

interface AdCardProps {
  ad: Ad;
  onClick: () => void;
  index: number;
}

export function AdCard({ ad, onClick, index }: AdCardProps) {
  // Generate a placeholder image based on ad_id for variety
  const imageIndex = parseInt(ad.ad_id) % 6 + 1;
  const placeholderImage = `https://images.unsplash.com/photo-${getImageId(imageIndex)}?w=400&h=300&fit=crop`;

  return (
    <article 
      onClick={onClick}
      className={cn(
        "group cursor-pointer rounded-xl overflow-hidden bg-card border border-border/50 shadow-card transition-all duration-300 hover:shadow-card-hover hover:border-primary/30 hover:-translate-y-1",
        "animate-fade-up"
      )}
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className="aspect-[4/3] relative overflow-hidden bg-secondary">
        <img 
          src={placeholderImage}
          alt={ad.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>
      
      <div className="p-4">
        <h3 className="font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
          {ad.title}
        </h3>
        
        <p className="mt-2 text-xl font-bold text-primary">
          {ad.price}
        </p>
        
        <div className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span>{ad.location}</span>
        </div>
      </div>
    </article>
  );
}

function getImageId(index: number): string {
  const images = [
    '1510915361894-db8b60106cb1', // guitar
    '1598488035139-bdbb2231ce04', // synth
    '1519892300165-cb5542fb47c7', // drums
    '1493225457124-a3eb161ffa5f', // music studio
    '1511379938547-c1f69419868d', // piano
    '1507838153414-b4b713384a76', // guitar closeup
  ];
  return images[index - 1] || images[0];
}
