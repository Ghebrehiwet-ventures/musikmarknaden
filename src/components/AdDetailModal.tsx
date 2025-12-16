import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Ad, AdDetails, getAdDetails } from "@/lib/api";
import { MapPin, Mail, Phone, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
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
    queryKey: ['ad-details', ad?.ad_id],
    queryFn: () => getAdDetails(ad!.ad_id),
    enabled: !!ad?.ad_id && open,
  });

  const images = details?.images || [];
  const hasMultipleImages = images.length > 1;

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  // Fallback images for demo
  const fallbackImages = [
    `https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=800&h=600&fit=crop`,
    `https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=800&h=600&fit=crop`,
  ];

  const displayImages = images.length > 0 ? images : fallbackImages;

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
              <img
                src={displayImages[currentImageIndex]}
                alt={ad?.title}
                className="w-full h-full object-cover"
              />
              
              {displayImages.length > 1 && (
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
                    {displayImages.map((_, idx) => (
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
                {ad?.price}
              </p>

              <div className="mt-2 flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{ad?.location}</span>
              </div>

              <div className="mt-6">
                <h4 className="font-semibold text-foreground mb-2">Description</h4>
                <p className="text-muted-foreground leading-relaxed">
                  {details?.description || "Lightly used, excellent condition. Perfect for beginners and professionals alike. Includes original case and accessories."}
                </p>
              </div>

              {/* Contact Info */}
              <div className="mt-6 pt-6 border-t border-border">
                <h4 className="font-semibold text-foreground mb-3">Contact Seller</h4>
                <div className="flex flex-wrap gap-3">
                  {(details?.contact_info?.email || true) && (
                    <Button variant="outline" className="gap-2">
                      <Mail className="h-4 w-4" />
                      {details?.contact_info?.email || "seller@example.com"}
                    </Button>
                  )}
                  {(details?.contact_info?.phone || true) && (
                    <Button variant="outline" className="gap-2">
                      <Phone className="h-4 w-4" />
                      {details?.contact_info?.phone || "+46 70 123 4567"}
                    </Button>
                  )}
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <Button className="flex-1" size="lg">
                  Contact Seller
                </Button>
                <Button variant="outline" size="lg">
                  Save
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
