import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MapPin, Mail, Phone, Loader2, ChevronLeft, ChevronRight, ExternalLink, User, CheckCircle, Share2 } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getAdDetails, fetchAdListings, Ad } from "@/lib/api";
import { CATEGORIES, mapToInternalCategory } from "@/lib/categories";
import { cn } from "@/lib/utils";

function getSourceInfo(url: string): { name: string; domain: string } {
  if (url.includes('musikborsen.se')) return { name: 'Musikbörsen', domain: 'musikborsen.se' };
  if (url.includes('gearloop.se')) return { name: 'Gearloop', domain: 'gearloop.se' };
  if (url.includes('dlxmusic.se')) return { name: 'DLX Music', domain: 'dlxmusic.se' };
  if (url.includes('blocketgitarr.se')) return { name: 'Blocket Gitarr', domain: 'blocketgitarr.se' };
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    const name = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
    return { name, domain };
  } catch {
    return { name: 'Källa', domain: '' };
  }
}

function cleanDescription(input: string, ad: Ad | null) {
  const lines = input
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const titleLower = ad?.title?.toLowerCase() || "";
  const locationLower = ad?.location?.toLowerCase() || "";
  const priceText = ad?.price_text?.replace(/\s/g, "") || "";

  const filtered = lines.filter((line) => {
    const lineLower = line.toLowerCase();
    const lineNoSpaces = line.replace(/\s/g, "");
    
    if (line.startsWith("![]") || line.startsWith("![") || line.startsWith("×!")) return false;
    if (line.startsWith("- [") && line.includes("gearloop.se")) return false;
    if (lineLower.includes("sveriges marknadsplats")) return false;
    if (lineLower.includes("om gearloop")) return false;
    if (/^(säljes|köpes)$/i.test(line)) return false;
    if (/^\d{1,2}:\d{2}$/.test(line)) return false;
    if (/^\d[\d\s]*:-?$/.test(line)) return false;
    if (/^[×x]$/i.test(line)) return false;
    if (/^\d{1,2}\s+(jan|feb|mar|apr|maj|jun|jul|aug|sep|okt|nov|dec)$/i.test(line)) return false;
    if (/^\d[\d\s]*kr\s*\d{1,2}\s*(jan|feb|mar|apr|maj|jun|jul|aug|sep|okt|nov|dec)/i.test(line)) return false;
    if (/^Skick:/i.test(line)) return false;
    if (/^Ny medlem$/i.test(line)) return false;
    if (lineLower === locationLower) return false;
    if (lineNoSpaces === priceText || lineNoSpaces === priceText.replace("kr", "") + ":-") return false;
    
    return true;
  });

  const withoutLinks = filtered.map((line) => line.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1"));
  const unique = withoutLinks.filter((line, i, arr) => i === 0 || line !== arr[i - 1]);

  return unique.join("\n").trim();
}

export default function AdDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [loadingTime, setLoadingTime] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  // Get ad from listing cache
  const { data: listingsData } = useQuery({
    queryKey: ['ads'],
    queryFn: () => fetchAdListings(),
    staleTime: 5 * 60 * 1000,
  });

  const ad = useMemo(() => {
    if (!id || !listingsData?.ads) return null;
    const decodedUrl = decodeURIComponent(id);
    return listingsData.ads.find(a => a.ad_url === decodedUrl) || null;
  }, [id, listingsData]);

  // Get full details
  const { data: details, isLoading } = useQuery({
    queryKey: ["ad-details", ad?.ad_url],
    queryFn: () => getAdDetails(ad!.ad_url),
    enabled: !!ad?.ad_url,
    retry: 1,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
  });

  // Track loading time
  useEffect(() => {
    let interval: number;
    if (isLoading) {
      setLoadingTime(0);
      interval = window.setInterval(() => {
        setLoadingTime(t => t + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLoading]);

  useEffect(() => {
    setCurrentImageIndex(0);
  }, [ad?.ad_url]);

  const sourceInfo = useMemo(() => 
    ad?.ad_url ? getSourceInfo(ad.ad_url) : { name: 'Källa', domain: '' }
  , [ad?.ad_url]);

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

  // Touch handlers for swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;
    
    if (Math.abs(diff) > 50) {
      if (diff > 0) nextImage();
      else prevImage();
    }
    setTouchStart(null);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          url: window.location.href,
        });
      } catch (e) {
        // User cancelled
      }
    }
  };

  if (!ad) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <p className="text-muted-foreground mb-4">Annonsen hittades inte</p>
        <Button asChild variant="outline">
          <Link to="/">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Tillbaka
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate(-1)}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Tillbaka</span>
          </Button>
          
          <Button variant="ghost" size="icon" onClick={handleShare}>
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="md:max-w-4xl md:mx-auto md:grid md:grid-cols-[1.2fr_1fr] md:gap-6 md:p-6">
        {/* Image Gallery */}
        <div 
          className="relative bg-secondary aspect-square md:aspect-auto md:min-h-[400px] md:rounded-lg overflow-hidden"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
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

          {images.length > 1 && (
            <>
              <button
                onClick={prevImage}
                className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/90 backdrop-blur items-center justify-center hover:bg-background transition-colors shadow-md"
                aria-label="Föregående bild"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={nextImage}
                className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/90 backdrop-blur items-center justify-center hover:bg-background transition-colors shadow-md"
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

              <div className="absolute top-4 right-4 bg-background/80 backdrop-blur rounded-full px-3 py-1 text-sm font-medium">
                {currentImageIndex + 1} / {images.length}
              </div>
            </>
          )}
        </div>

        {/* Details Panel */}
        <div className="p-4 md:p-0">
          <h1 className="text-xl md:text-2xl font-bold leading-tight">{title}</h1>

          <p className="mt-3 text-3xl md:text-4xl font-bold text-primary">{priceText}</p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {(() => {
              const internalCat = ad.category && CATEGORIES.some(c => c.id === ad.category)
                ? ad.category
                : mapToInternalCategory(ad.title);
              const catInfo = CATEGORIES.find(c => c.id === internalCat);
              if (catInfo) {
                const Icon = catInfo.icon;
                return (
                  <Badge variant="secondary" className="gap-1.5">
                    <Icon className="h-3 w-3" />
                    {catInfo.label}
                  </Badge>
                );
              }
              return null;
            })()}

            {details?.condition && (
              <Badge variant="outline" className="gap-1">
                <CheckCircle className="h-3 w-3" />
                {details.condition}
              </Badge>
            )}
          </div>

          {location && (
            <div className="mt-3 flex items-center gap-1.5 text-muted-foreground text-sm">
              <MapPin className="h-4 w-4" />
              <span>{location}</span>
            </div>
          )}

          {/* Description */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-foreground">Beskrivning</h2>
              {isLoading && (
                <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {loadingTime >= 5 ? "Det tar lite längre..." : "Hämtar detaljer..."}
                </span>
              )}
            </div>

            {isLoading ? (
              <div className="space-y-2.5">
                <div className={cn("h-4 rounded bg-muted/70 animate-pulse", loadingTime >= 3 ? "w-full" : "w-11/12")} />
                <div className="h-4 rounded bg-muted/60 animate-pulse w-10/12" style={{ animationDelay: "75ms" }} />
                <div className="h-4 rounded bg-muted/50 animate-pulse w-9/12" style={{ animationDelay: "150ms" }} />
                <div className="h-4 rounded bg-muted/40 animate-pulse w-8/12" style={{ animationDelay: "225ms" }} />
                {loadingTime >= 5 && (
                  <p className="text-xs text-muted-foreground mt-3 animate-fade-in">
                    Första gången tar längre – sedan cachas det i 7 dagar.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap text-sm">
                {description || "Ingen beskrivning hittades."}
              </p>
            )}
          </div>

          {/* Seller info */}
          {details?.seller && (details.seller.name || details.seller.username) && (
            <div className="mt-6">
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
          <div className="mt-6 pt-6 border-t border-border">
            {details?.contact_info && (details.contact_info.email || details.contact_info.phone) && (
              <div className="mb-4">
                <h3 className="font-semibold text-foreground mb-3 text-sm">Kontakta säljare</h3>
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
              <a href={ad.ad_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Visa på {sourceInfo.name}
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
