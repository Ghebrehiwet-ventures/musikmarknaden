import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Ad, AdDetails, getAdDetails } from "@/lib/api";
import { MapPin, Mail, Phone, Loader2, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

interface AdDetailModalProps {
  ad: Ad | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdDetailModal({ ad, open, onOpenChange }: AdDetailModalProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const { data: details, isLoading } = useQuery({
    queryKey: ['ad-details', ad?.ad_url],
    queryFn: () => getAdDetails(ad!.ad_url),
    enabled: !!ad?.ad_url && open,
  });

  const images = details?.images || (ad?.image_url ? [ad.image_url] : []);
  
  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-card border-border/50 p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Image Gallery */}
            <div className="relative aspect-video bg-secondary">
              {images.length > 0 && (
                <img
                  src={images[currentImageIndex]}
                  alt={ad?.title}
                  className="w-full h-full object-cover"
                />
              )}
              
              {images.length > 1 && (
                <>
                  <button
                    onClick={prevImage}
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/80 backdrop-blur flex items-center justify-center hover:bg-background transition-colors"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/80 backdrop-blur flex items-center justify-center hover:bg-background transition-colors"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {images.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentImageIndex(idx)}
                        className={`h-2 w-2 rounded-full transition-colors ${
                          idx === currentImageIndex ? 'bg-primary' : 'bg-foreground/30'
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Content */}
            <div className="p-6">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold">
                  {ad?.title}
                </DialogTitle>
              </DialogHeader>

              <p className="mt-4 text-3xl font-bold text-primary">
                {ad?.price_text || details?.price_text || "Pris ej angivet"}
              </p>

              <div className="mt-2 flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{ad?.location || details?.location}</span>
              </div>

              {ad?.category && (
                <span className="inline-block mt-2 bg-primary/10 text-primary text-sm px-3 py-1 rounded-md">
                  {ad.category}
                </span>
              )}

              <div className="mt-6">
                <h4 className="font-semibold text-foreground mb-2">Beskrivning</h4>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {details?.description || "Laddar beskrivning..."}
                </p>
              </div>

              {/* Contact Info */}
              {details?.contact_info && (details.contact_info.email || details.contact_info.phone) && (
                <div className="mt-6 pt-6 border-t border-border">
                  <h4 className="font-semibold text-foreground mb-3">Kontakta säljare</h4>
                  <div className="flex flex-wrap gap-3">
                    {details.contact_info.email && (
                      <Button variant="outline" className="gap-2" asChild>
                        <a href={`mailto:${details.contact_info.email}`}>
                          <Mail className="h-4 w-4" />
                          {details.contact_info.email}
                        </a>
                      </Button>
                    )}
                    {details.contact_info.phone && (
                      <Button variant="outline" className="gap-2" asChild>
                        <a href={`tel:${details.contact_info.phone}`}>
                          <Phone className="h-4 w-4" />
                          {details.contact_info.phone}
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-6 flex gap-3">
                <Button className="flex-1" size="lg" asChild>
                  <a href={ad?.ad_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Visa på Gearloop
                  </a>
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
