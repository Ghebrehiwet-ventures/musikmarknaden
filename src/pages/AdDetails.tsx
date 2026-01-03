import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MapPin, Mail, Phone, Loader2, ChevronLeft, ChevronRight, ExternalLink, User, CheckCircle, Share2 } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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

function cleanDescription(input: string, ad: Ad | null): string {
  const lines = input
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const titleLower = ad?.title?.toLowerCase() || "";
  const locationLower = ad?.location?.toLowerCase() || "";
  const priceText = ad?.price_text?.replace(/\s/g, "") || "";

  // Patterns to filter out UI garbage from scraped content
  const uiPatterns = [
    /\(Esc\)/i,
    /^Rapportera annons$/i,
    /^Rapportera$/i,
    /^AvbrytSkicka$/i,
    /^Avbryt$/i,
    /^Skicka$/i,
    /^Skicka meddelande$/i,
    /^Typ:\s*SpamBedrägeriAnnat$/i,
    /Ange en kort beskrivning varför du vill rapportera/i,
    /^Ny medlem$/i,
    /^Kan skickas$/i,
    /^Kan mötas$/i,
    /^Betalning:/i,
    /^Frakt:/i,
    /^×$/,
    /^x$/i,
    /^\d{1,2}:\d{2}$/,
    /^\d[\d\s]*:-?$/,
    /^\d{1,2}\s+(jan|feb|mar|apr|maj|jun|jul|aug|sep|okt|nov|dec)$/i,
    /^\d[\d\s]*kr\s*\d{1,2}\s*(jan|feb|mar|apr|maj|jun|jul|aug|sep|okt|nov|dec)/i,
    /^Skick:/i,
    /^(säljes|köpes)$/i,
    /sveriges marknadsplats/i,
    /om gearloop/i,
    /^!\[/,
    /^×!/,
    /gearloop\.se/i,
    /^Visa telefonnummer$/i,
    /^Visa e-post$/i,
    /^Kontakta säljare$/i,
    /^Säljare$/i,
    /^Annonsera$/i,
    /^Logga in$/i,
    /^Registrera$/i,
    /^Mina sidor$/i,
    /^Hem$/i,
    /^Sök$/i,
  ];

  const filtered = lines.filter((line) => {
    const lineLower = line.toLowerCase();
    const lineNoSpaces = line.replace(/\s/g, "");

    // Check against UI patterns
    for (const pattern of uiPatterns) {
      if (pattern.test(line)) return false;
    }

    // Filter out markdown image syntax
    if (line.startsWith("- [") && line.includes("gearloop.se")) return false;

    // Filter location/price duplicates
    if (lineLower === locationLower) return false;
    if (lineNoSpaces === priceText || lineNoSpaces === priceText.replace("kr", "") + ":-") return false;

    return true;
  });

  // Remove markdown links, keep text
  const withoutLinks = filtered.map((line) => line.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1"));
  
  // Remove consecutive duplicates
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
      } catch {
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

  const categoryInfo = (() => {
    const internalCat = ad.category && CATEGORIES.some(c => c.id === ad.category)
      ? ad.category
      : mapToInternalCategory(ad.title);
    return CATEGORIES.find(c => c.id === internalCat);
  })();

  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-8">
      {/* Header - Mobile */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border lg:hidden">
        <div className="flex items-center justify-between px-4 h-14">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <Button variant="ghost" size="icon" onClick={handleShare}>
            <Share2 className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Desktop Header */}
      <header className="hidden lg:block border-b border-border bg-background">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate(-1)}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Tillbaka till annonser
          </Button>
          
          <Button variant="ghost" size="sm" onClick={handleShare} className="gap-2">
            <Share2 className="h-4 w-4" />
            Dela
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="lg:max-w-6xl lg:mx-auto lg:px-6 lg:py-8">
        <div className="lg:grid lg:grid-cols-[1fr_380px] lg:gap-8">
          
          {/* Left Column - Images & Description */}
          <div>
            {/* Image Gallery - Mobile: Full width, Desktop: Rounded */}
            <div 
              className="relative bg-secondary aspect-square lg:aspect-[4/3] lg:rounded-xl overflow-hidden"
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
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  Ingen bild
                </div>
              )}

              {images.length > 1 && (
                <>
                  {/* Desktop nav buttons */}
                  <button
                    onClick={prevImage}
                    className="hidden lg:flex absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-background/90 backdrop-blur items-center justify-center hover:bg-background transition-colors shadow-lg"
                    aria-label="Föregående bild"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  <button
                    onClick={nextImage}
                    className="hidden lg:flex absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-background/90 backdrop-blur items-center justify-center hover:bg-background transition-colors shadow-lg"
                    aria-label="Nästa bild"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>

                  {/* Image counter */}
                  <div className="absolute top-4 right-4 bg-background/80 backdrop-blur rounded-full px-3 py-1.5 text-sm font-medium">
                    {currentImageIndex + 1} / {images.length}
                  </div>

                  {/* Dots indicator */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-background/80 backdrop-blur rounded-full px-3 py-2">
                    {images.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentImageIndex(idx)}
                        className={cn(
                          "h-2 w-2 rounded-full transition-all",
                          idx === currentImageIndex 
                            ? "bg-primary w-4" 
                            : "bg-foreground/30 hover:bg-foreground/50"
                        )}
                        aria-label={`Bild ${idx + 1}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Thumbnails - Desktop only */}
            {images.length > 1 && (
              <div className="hidden lg:flex gap-2 mt-4 overflow-x-auto pb-2">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentImageIndex(idx)}
                    className={cn(
                      "flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all",
                      idx === currentImageIndex 
                        ? "border-primary ring-2 ring-primary/20" 
                        : "border-transparent hover:border-border"
                    )}
                  >
                    <img
                      src={img}
                      alt={`Bild ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

            {/* Mobile: Title & Price */}
            <div className="p-4 lg:hidden">
              <h1 className="text-xl font-bold leading-tight">{title}</h1>
              <p className="mt-2 text-2xl font-bold text-primary">{priceText}</p>
              
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {categoryInfo && (
                  <Badge variant="secondary" className="gap-1.5">
                    <categoryInfo.icon className="h-3 w-3" />
                    {categoryInfo.label}
                  </Badge>
                )}

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
            </div>

            {/* Description Section */}
            <div className="px-4 pb-6 lg:px-0 lg:mt-8">
              <h2 className="font-semibold text-lg text-foreground mb-3">Beskrivning</h2>
              
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-11/12" />
                  <Skeleton className="h-4 w-10/12" />
                  <Skeleton className="h-4 w-9/12" />
                  {loadingTime >= 3 && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {loadingTime >= 6 
                        ? "Första laddningen tar längre – cachas sedan i 7 dagar."
                        : "Hämtar detaljer..."}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {description || "Ingen beskrivning tillgänglig."}
                </p>
              )}
            </div>

            {/* Seller - Desktop */}
            {details?.seller && (details.seller.name || details.seller.username) && (
              <div className="hidden lg:block mt-6 p-4 rounded-xl bg-secondary/50">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-6 w-6 text-primary" />
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
          </div>

          {/* Right Column - Desktop Sticky Panel */}
          <div className="hidden lg:block">
            <div className="sticky top-8 space-y-6">
              {/* Price Card */}
              <div className="p-6 rounded-xl border border-border bg-card">
                <p className="text-3xl font-bold text-primary">{priceText}</p>
                <h1 className="mt-3 text-xl font-semibold leading-tight">{title}</h1>
                
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {categoryInfo && (
                    <Badge variant="secondary" className="gap-1.5">
                      <categoryInfo.icon className="h-3 w-3" />
                      {categoryInfo.label}
                    </Badge>
                  )}

                  {details?.condition && (
                    <Badge variant="outline" className="gap-1">
                      <CheckCircle className="h-3 w-3" />
                      {details.condition}
                    </Badge>
                  )}
                </div>

                {location && (
                  <div className="mt-4 flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{location}</span>
                  </div>
                )}

                {/* Actions */}
                <div className="mt-6 space-y-3">
                  <Button className="w-full" size="lg" asChild>
                    <a href={ad.ad_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Visa på {sourceInfo.name}
                    </a>
                  </Button>

                  {details?.contact_info && (details.contact_info.email || details.contact_info.phone) && (
                    <div className="flex gap-2">
                      {details.contact_info.email && (
                        <Button variant="outline" className="flex-1 gap-2" asChild>
                          <a href={`mailto:${details.contact_info.email}`}>
                            <Mail className="h-4 w-4" />
                            E-post
                          </a>
                        </Button>
                      )}
                      {details.contact_info.phone && (
                        <Button variant="outline" className="flex-1 gap-2" asChild>
                          <a href={`tel:${details.contact_info.phone}`}>
                            <Phone className="h-4 w-4" />
                            Ring
                          </a>
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Seller Card */}
              {details?.seller && (details.seller.name || details.seller.username) && (
                <div className="p-4 rounded-xl border border-border bg-card">
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Säljare</h3>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{details.seller.name}</p>
                      {details.seller.username && (
                        <p className="text-sm text-muted-foreground">@{details.seller.username}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t border-border lg:hidden safe-area-bottom">
        <div className="flex gap-3">
          {details?.contact_info?.phone && (
            <Button variant="outline" size="lg" className="gap-2" asChild>
              <a href={`tel:${details.contact_info.phone}`}>
                <Phone className="h-5 w-5" />
              </a>
            </Button>
          )}
          {details?.contact_info?.email && (
            <Button variant="outline" size="lg" className="gap-2" asChild>
              <a href={`mailto:${details.contact_info.email}`}>
                <Mail className="h-5 w-5" />
              </a>
            </Button>
          )}
          <Button className="flex-1" size="lg" asChild>
            <a href={ad.ad_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Visa på {sourceInfo.name}
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
