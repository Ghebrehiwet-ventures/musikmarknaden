import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Badge } from "./ui/badge";
import { Ad, getAdDetails } from "@/lib/api";
import { MapPin, Mail, Phone, Loader2, ChevronLeft, ChevronRight, ExternalLink, User, CheckCircle } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

interface AdDetailModalProps {
  ad: Ad | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function cleanDescription(input: string, ad: Ad | null) {
  const lines = input
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // Get values to filter out duplicates
  const titleLower = ad?.title?.toLowerCase() || "";
  const locationLower = ad?.location?.toLowerCase() || "";
  const priceText = ad?.price_text?.replace(/\s/g, "") || "";

  const filtered = lines.filter((line) => {
    const lineLower = line.toLowerCase();
    const lineNoSpaces = line.replace(/\s/g, "");
    
    // Skip markdown images
    if (line.startsWith("![]") || line.startsWith("![") || line.startsWith("×!")) return false;
    // Skip gearloop links
    if (line.startsWith("- [") && line.includes("gearloop.se")) return false;
    // Skip footer text
    if (lineLower.includes("sveriges marknadsplats")) return false;
    if (lineLower.includes("om gearloop")) return false;
    // Skip status words
    if (/^(säljes|köpes)$/i.test(line)) return false;
    // Skip timestamps
    if (/^\d{1,2}:\d{2}$/.test(line)) return false;
    // Skip standalone price
    if (/^\d[\d\s]*:-?$/.test(line)) return false;
    // Skip standalone × or x
    if (/^[×x]$/i.test(line)) return false;
    // Skip dates like "16 nov"
    if (/^\d{1,2}\s+(jan|feb|mar|apr|maj|jun|jul|aug|sep|okt|nov|dec)$/i.test(line)) return false;
    // Skip price history (price + date)
    if (/^\d[\d\s]*kr\s*\d{1,2}\s*(jan|feb|mar|apr|maj|jun|jul|aug|sep|okt|nov|dec)/i.test(line)) return false;
    // Skip condition line (shown separately)
    if (/^Skick:/i.test(line)) return false;
    // Skip member status
    if (/^Ny medlem$/i.test(line)) return false;
    // Skip if it's just the location
    if (lineLower === locationLower) return false;
    // Skip if it's just the price
    if (lineNoSpaces === priceText || lineNoSpaces === priceText.replace("kr", "") + ":-") return false;
    
    return true;
  });

  // Remove markdown link syntax
  const withoutLinks = filtered.map((line) => line.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1"));
  
  // Remove duplicate consecutive lines
  const unique = withoutLinks.filter((line, i, arr) => i === 0 || line !== arr[i - 1]);

  return unique.join("\n").trim();
}

export function AdDetailModal({ ad, open, onOpenChange }: AdDetailModalProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [loadingTime, setLoadingTime] = useState(0);
  const queryClient = useQueryClient();

  // Check if data is already cached
  const isCached = ad?.ad_url 
    ? !!queryClient.getQueryData(["ad-details", ad.ad_url]) 
    : false;

  const { data: details, isLoading, isFetching } = useQuery({
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

  // Track loading time for better UX feedback
  useEffect(() => {
    let interval: number;
    if (isLoading && !isCached) {
      setLoadingTime(0);
      interval = window.setInterval(() => {
        setLoadingTime(t => t + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLoading, isCached]);

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
  const priceText = (ad?.price_text && ad?.price_amount !== null) 
    ? ad.price_text 
    : (details?.price_text && details?.price_amount !== null) 
      ? details.price_text 
      : "Pris ej angivet";
  const location = ad?.location ?? details?.location ?? "";
  const description = details?.description ? cleanDescription(details.description, ad) : "";

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
      <DialogContent className="max-w-4xl bg-card border-border/50 p-0 max-h-[90vh] overflow-y-auto overscroll-contain">
        <div className="md:grid md:grid-cols-[1.2fr_1fr]">
          {/* Image Gallery */}
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

            {images.length > 1 && (
              <div className="absolute top-4 right-4 bg-background/80 backdrop-blur rounded-full px-3 py-1 text-sm font-medium">
                {currentImageIndex + 1} / {images.length}
              </div>
            )}
          </div>

          {/* Details Panel */}
          <div className="flex flex-col max-h-[90vh] md:max-h-[85vh]">
            <div className="p-6 pb-4">
              <DialogHeader>
                <DialogTitle className="text-xl md:text-2xl font-bold leading-tight pr-8">{title}</DialogTitle>
              </DialogHeader>

              <p className="mt-4 text-3xl md:text-4xl font-bold text-primary">{priceText}</p>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                {location && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{location}</span>
                  </div>
                )}
                
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

            {/* Description with scroll */}
            <div className="px-6 pb-4 flex-1 min-h-0">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-foreground">Beskrivning</h4>
                {isLoading && !isCached && (
                  <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {loadingTime >= 5 
                      ? "Det tar lite längre..." 
                      : "Hämtar från Gearloop..."}
                  </span>
                )}
              </div>

              {isLoading && !isCached ? (
                <div className="space-y-2.5">
                  <div className={cn("h-4 rounded bg-muted/70 animate-pulse", loadingTime >= 3 ? "w-full" : "w-11/12")} />
                  <div className={cn("h-4 rounded bg-muted/60 animate-pulse", loadingTime >= 3 ? "w-11/12" : "w-10/12")} style={{ animationDelay: "75ms" }} />
                  <div className={cn("h-4 rounded bg-muted/50 animate-pulse", loadingTime >= 3 ? "w-10/12" : "w-9/12")} style={{ animationDelay: "150ms" }} />
                  <div className="h-4 rounded bg-muted/40 animate-pulse w-8/12" style={{ animationDelay: "225ms" }} />
                  {loadingTime >= 5 && (
                    <p className="text-xs text-muted-foreground mt-3 animate-fade-in">
                      Första gången tar längre – sedan cachas det i 7 dagar.
                    </p>
                  )}
                </div>
              ) : (
                <ScrollArea className="h-[150px] md:h-[200px]">
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap text-sm pr-4">
                    {description || "Ingen beskrivning hittades."}
                  </p>
                </ScrollArea>
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
