import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Skeleton } from "./ui/skeleton";
import { Ad, getAdDetails } from "@/lib/api";
import { MapPin, Mail, Phone, Loader2, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
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
    return true;
  });

  // Strip markdown links: [text](url) -> text
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
      <DialogContent className="max-w-5xl bg-card border-border/50 p-0 overflow-hidden">
        <div className="md:grid md:grid-cols-[1.1fr_0.9fr]">
          {/* Media */}
          <div className="relative bg-secondary">
            <div className="aspect-[4/3] md:aspect-auto md:h-full">
              {images.length > 0 ? (
                <img
                  src={images[currentImageIndex]}
                  alt={title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  Ingen bild
                </div>
              )}
            </div>

            {images.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/80 backdrop-blur flex items-center justify-center hover:bg-background transition-colors"
                  aria-label="Föregående bild"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/80 backdrop-blur flex items-center justify-center hover:bg-background transition-colors"
                  aria-label="Nästa bild"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>

                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {images.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentImageIndex(idx)}
                      className={`h-2 w-2 rounded-full transition-colors ${
                        idx === currentImageIndex ? "bg-primary" : "bg-foreground/30"
                      }`}
                      aria-label={`Bild ${idx + 1}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Details */}
          <div className="flex flex-col max-h-[85vh]">
            <div className="p-6">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold">{title}</DialogTitle>
              </DialogHeader>

              <p className="mt-4 text-3xl font-bold text-primary">{priceText}</p>

              <div className="mt-2 flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{location || "Plats ej angiven"}</span>
              </div>

              {ad?.category && (
                <span className="inline-flex mt-3 bg-primary/10 text-primary text-sm px-3 py-1 rounded-md">
                  {ad.category}
                </span>
              )}
            </div>

            <div className="px-6 pb-6">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-foreground">Beskrivning</h4>
                {isLoading && (
                  <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Hämtar…
                  </span>
                )}
              </div>

              <ScrollArea className="h-[32vh] md:h-[40vh] pr-4">
                {isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-11/12" />
                    <Skeleton className="h-4 w-10/12" />
                    <Skeleton className="h-4 w-9/12" />
                    <Skeleton className="h-4 w-8/12" />
                    <Skeleton className="h-4 w-10/12" />
                  </div>
                ) : (
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {description || "Ingen beskrivning hittades."}
                  </p>
                )}
              </ScrollArea>
            </div>

            <div className="mt-auto p-6 border-t border-border/50">
              {details?.contact_info && (details.contact_info.email || details.contact_info.phone) && (
                <div className="mb-4">
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

              <Button className="w-full" size="lg" asChild>
                <a href={ad?.ad_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Visa på Gearloop
                </a>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

