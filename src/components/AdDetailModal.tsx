import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Skeleton } from "./ui/skeleton";
import { Badge } from "./ui/badge";
import { Ad, getAdDetails } from "@/lib/api";
import { MapPin, Mail, Phone, Loader2, ChevronLeft, ChevronRight, ExternalLink, User, CheckCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

interface AdDetailModalProps {
  ad: Ad | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function cleanDescription(input: string) {
  const lines = input
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const filtered = lines.filter((line) => {
    if (line.startsWith("![]") || line.startsWith("![") || line.startsWith("×!")) return false;
    if (line.startsWith("- [") && line.includes("gearloop.se")) return false;
    if (line.toLowerCase().includes("sveriges marknadsplats")) return false;
    if (line.toLowerCase().includes("om gearloop")) return false;
    if (/^(säljes|köpes)$/i.test(line)) return false;
    if (/^\d{1,2}:\d{2}$/.test(line)) return false;
    if (/^\d+\s*:-?$/.test(line)) return false;
    return true;
  });

  const withoutLinks = filtered.map((line) => line.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1"));

  return withoutLinks.join("\n").trim();
}

export function AdDetailModal({ ad, open, onOpenChange }: AdDetailModalProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const { data: details, isLoading } = useQuery({
    queryKey: ["ad-details", ad?.ad_url],
    queryFn: () => getAdDetails(ad!.ad_url),
    enabled: !!ad?.ad_url && open,
    retry: 1,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  useEffect(() => {
    setCurrentImageIndex(0);
  }, [ad?.ad_url]);

  const images = useMemo(() => {
    const list = [
      ...(details?.images ?? []),
      ...(ad?.image_url ? [ad.image_url] : []),
    ].filter(Boolean);
    return Array.from(new Set(list));
  }, [details?.images, ad?.image_url]);

  const title = ad?.title ?? details?.title ?? "Annons";
  const priceText = ad?.price_text ?? details?.price_text ?? "Pris ej angivet";
  const location = ad?.location ?? details?.location ?? "";
  const description = details?.description ? cleanDescription(details.description) : "";

  const nextImage = () => {
    if (images.length === 0) return;
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    if (images.length === 0) return;
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl bg-card border-border/50 p-0 overflow-hidden max-h-[90vh]">
        <div className="md:grid md:grid-cols-[1.2fr_1fr]">
          {/* Media */}
          <div className="relative bg-secondary">
            <div className="aspect-square md:aspect-auto md:h-full min-h-[300px]">
              {images.length > 0 ? (
                <img
                  src={images[currentImageIndex]}
                  alt={title}
                  className="w-full h-full object-contain bg-secondary"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground min-h-[300px]">
                  Ingen bild
                </div>
              )}
            </div>

            {images.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/90 backdrop-blur flex items-center justify-center hover:bg-background transition-colors shadow-md"
                  aria-label="Föregående bild"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/90 backdrop-blur flex items-center justify-center hover:bg-background transition-colors shadow-md"
                  aria-label="Nästa bild"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>

                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-background/80 backdrop-blur rounded-full px-3 py-1.5">
                  {images.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentImageIndex(idx)}
                      className={`h-2.5 w-2.5 rounded-full transition-all ${
                        idx === currentImageIndex ? "bg-primary scale-110" : "bg-foreground/30 hover:bg-foreground/50"
                      }`}
                      aria-label={`Bild ${idx + 1}`}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Image counter */}
            {images.length > 1 && (
              <div className="absolute top-4 right-4 bg-background/80 backdrop-blur rounded-full px-3 py-1 text-sm font-medium">
                {currentImageIndex + 1} / {images.length}
              </div>
            )}
          </div>

          {/* Details */}
          <ScrollArea className="max-h-[90vh] md:max-h-none">
            <div className="flex flex-col">
              <div className="p-6 pb-4">
                <DialogHeader>
                  <DialogTitle className="text-xl md:text-2xl font-bold leading-tight pr-8">{title}</DialogTitle>
                </DialogHeader>

                <p className="mt-4 text-3xl md:text-4xl font-bold text-primary">{priceText}</p>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{location || "Plats ej angiven"}</span>
                  </div>
                  
                  {details?.condition && (
                    <Badge variant="secondary" className="gap-1">
                      <CheckCircle className="h-3 w-3" />
                      {details.condition}
                    </Badge>
                  )}
                </div>

                {ad?.category && (
                  <Badge variant="outline" className="mt-3 bg-primary/10 text-primary border-primary/20">
                    {ad.category}
                  </Badge>
                )}
              </div>

              <div className="px-6 pb-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-foreground">Beskrivning</h4>
                  {isLoading && (
                    <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Hämtar…
                    </span>
                  )}
                </div>

                {isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-11/12" />
                    <Skeleton className="h-4 w-10/12" />
                    <Skeleton className="h-4 w-9/12" />
                  </div>
                ) : (
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap text-sm">
                    {description || "Ingen beskrivning hittades."}
                  </p>
                )}
              </div>

              {/* Seller info */}
              {details?.seller && (details.seller.name || details.seller.username) && (
                <div className="px-6 pb-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{details.seller.name}</p>
                      {details.seller.username && (
                        <p className="text-sm text-muted-foreground">@{details.seller.username}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Contact & Actions */}
              <div className="p-6 pt-4 border-t border-border/50 mt-auto">
                {details?.contact_info && (details.contact_info.email || details.contact_info.phone) && (
                  <div className="mb-4">
                    <h4 className="font-semibold text-foreground mb-3 text-sm">Kontakta säljare</h4>
                    <div className="flex flex-wrap gap-2">
                      {details.contact_info.email && (
                        <Button variant="outline" size="sm" className="gap-2" asChild>
                          <a href={`mailto:${details.contact_info.email}`}>
                            <Mail className="h-4 w-4" />
                            E-post
                          </a>
                        </Button>
                      )}
                      {details.contact_info.phone && (
                        <Button variant="outline" size="sm" className="gap-2" asChild>
                          <a href={`tel:${details.contact_info.phone}`}>
                            <Phone className="h-4 w-4" />
                            Ring
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                <Button className="w-full" size="lg" asChild>
                  <a href={ad?.ad_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Visa på Gearloop
                  </a>
                </Button>
              </div>
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

