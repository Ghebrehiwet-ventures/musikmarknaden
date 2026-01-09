import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Mail, Phone, Loader2, ChevronLeft, ChevronRight, ExternalLink, User, CheckCircle, Share2, ChevronRight as ChevronRightIcon } from "lucide-react";
import { useState, useMemo, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Header } from "@/components/Header";
import { ImageLightbox, ZoomHint } from "@/components/ImageLightbox";
import { getAdDetails, fetchAdListings, Ad } from "@/lib/api";
import { CATEGORIES, mapToInternalCategory } from "@/lib/categories";
import { cn } from "@/lib/utils";

// Ensure external URLs open in new tab
function handleExternalClick(e: React.MouseEvent<HTMLAnchorElement>, url: string) {
  e.preventDefault();
  // Normalize URL
  let normalizedUrl = url;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    normalizedUrl = 'https://' + url;
  }
  window.open(normalizedUrl, '_blank', 'noopener,noreferrer');
}

function getSourceInfo(url: string): { name: string; domain: string } {
  if (url.includes('musikborsen.se')) return { name: 'Musikbörsen.se', domain: 'musikborsen.se' };
  if (url.includes('gearloop.se')) return { name: 'Gearloop.se', domain: 'gearloop.se' };
  if (url.includes('dlxmusic.se')) return { name: 'DLXmusic.se', domain: 'dlxmusic.se' };
  if (url.includes('blocketgitarr.se')) return { name: 'BlocketGitarr.se', domain: 'blocketgitarr.se' };
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    const name = domain.charAt(0).toUpperCase() + domain.slice(1);
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

    for (const pattern of uiPatterns) {
      if (pattern.test(line)) return false;
    }

    if (line.startsWith("- [") && line.includes("gearloop.se")) return false;
    if (lineLower === locationLower) return false;
    if (lineNoSpaces === priceText || lineNoSpaces === priceText.replace("kr", "") + ":-") return false;

    return true;
  });

  const withoutLinks = filtered.map((line) => line.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1"));
  const unique = withoutLinks.filter((line, i, arr) => i === 0 || line !== arr[i - 1]);

  return unique.join("\n").trim();
}

// Component to render formatted description with paragraphs and bullet lists
function FormattedDescription({ text }: { text: string }) {
  // Split by double newlines into paragraphs
  const blocks = text.split(/\n\n+/).filter(Boolean);
  
  return (
    <div className="text-muted-foreground leading-relaxed space-y-4">
      {blocks.map((block, blockIndex) => {
        const lines = block.split('\n').filter(Boolean);
        
        // Check if this block is a bullet list (most lines start with •)
        const bulletLines = lines.filter(line => line.trim().startsWith('•'));
        const isBulletList = bulletLines.length > 0 && bulletLines.length >= lines.length * 0.5;
        
        if (isBulletList) {
          // Render as a styled list
          return (
            <ul key={blockIndex} className="space-y-2">
              {lines.map((line, lineIndex) => {
                const cleanLine = line.trim().replace(/^•\s*/, '');
                if (!cleanLine) return null;
                return (
                  <li key={lineIndex} className="text-sm">
                    {cleanLine}
                  </li>
                );
              })}
            </ul>
          );
        }
        
        // Check if this is a separator
        if (block.trim() === '---') {
          return <hr key={blockIndex} className="border-border" />;
        }
        
        // Regular paragraph - join lines with spaces
        return (
          <p key={blockIndex}>
            {lines.join(' ')}
          </p>
        );
      })}
    </div>
  );
}

// Specifications Table Component
function SpecificationsTable({ specifications }: { specifications: Array<{ label: string; value: string }> }) {
  if (!specifications || specifications.length === 0) return null;
  
  return (
    <div className="mt-8 px-4 lg:px-0">
      <h2 className="font-semibold text-lg text-foreground mb-3">Specifikationer</h2>
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <tbody>
            {specifications.map((spec, index) => (
              <tr 
                key={index}
                className={cn(
                  "border-b border-border last:border-0",
                  index % 2 === 0 ? "bg-secondary/30" : "bg-background"
                )}
              >
                <td className="px-4 py-3 font-medium text-muted-foreground w-1/3 lg:w-1/4">
                  {spec.label}
                </td>
                <td className="px-4 py-3 text-foreground">
                  {spec.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Similar Ads Carousel Component
function SimilarAdsCarousel({ ads, currentAdUrl }: { ads: Ad[]; currentAdUrl: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    const ref = scrollRef.current;
    if (ref) {
      ref.addEventListener('scroll', checkScroll);
      return () => ref.removeEventListener('scroll', checkScroll);
    }
  }, [ads]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 280;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  if (ads.length === 0) return null;

  return (
    <div className="relative">
      {/* Navigation Buttons */}
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-background/90 backdrop-blur border border-border shadow-lg flex items-center justify-center hover:bg-background transition-colors -ml-5"
          aria-label="Scrolla vänster"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-background/90 backdrop-blur border border-border shadow-lg flex items-center justify-center hover:bg-background transition-colors -mr-5"
          aria-label="Scrolla höger"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}

      {/* Scrollable Container */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4 lg:mx-0 lg:px-0"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {ads.map((ad) => (
          <Link
            key={ad.ad_url}
            to={`/ad/${encodeURIComponent(ad.ad_url)}`}
            className="flex-shrink-0 w-[200px] lg:w-[220px] group"
            style={{ scrollSnapAlign: 'start' }}
          >
            <div className="aspect-square rounded-lg overflow-hidden bg-secondary mb-2">
              {ad.image_url ? (
                <img
                  src={ad.image_url}
                  alt={ad.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                  Ingen bild
                </div>
              )}
            </div>
            <h3 className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors">
              {ad.title}
            </h3>
            <p className="text-primary font-bold text-sm mt-1">
              {ad.price_text || "Pris ej angivet"}
            </p>
            {ad.location && (
              <p className="text-muted-foreground text-xs mt-0.5 flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {ad.location}
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function AdDetails() {
  const { id } = useParams<{ id: string }>();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
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

  // Check if we have a cached description already (instant display)
  const hasCachedDescription = !!ad?.description && ad.description.length > 20;

  // Get full details (only if needed for images/contact or if no cached description)
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
    // Helper to detect thumbnail URLs (should not be shown if we have better images)
    const isThumbnailUrl = (url: string): boolean => {
      if (!url) return false;
      return /\/(?:128|256)\//.test(url) || 
             /max-width=(?:12[0-8]|25[0-6]|[1-9]\d?)\b/i.test(url);
    };

    // Helper to normalize WordPress image URLs for deduplication
    // Handles: -300x200, -scaled, -rotated, query params, case differences
    const normalizeWpUrl = (url: string): string => {
      try {
        const parsed = new URL(url);
        let path = parsed.pathname.toLowerCase();
        // Remove WordPress size suffixes like -300x200, -768x1024
        path = path.replace(/-\d+x\d+(?=\.(jpg|jpeg|png|gif|webp))/i, '');
        // Remove -scaled, -rotated suffixes
        path = path.replace(/-(scaled|rotated)(?=\.(jpg|jpeg|png|gif|webp))/i, '');
        return parsed.origin + path;
      } catch {
        let normalized = url.split('?')[0].toLowerCase();
        normalized = normalized.replace(/-\d+x\d+(?=\.(jpg|jpeg|png|gif|webp))/i, '');
        normalized = normalized.replace(/-(scaled|rotated)(?=\.(jpg|jpeg|png|gif|webp))/i, '');
        return normalized;
      }
    };

    const detailImages = details?.images ?? [];
    const listingImage = ad?.image_url;

    // Build deduplicated list from details first (authoritative). Only fall back to listing image if details has none.
    const seen = new Set<string>();
    const unique: string[] = [];

    for (const img of detailImages) {
      if (!img) continue;
      const normalized = normalizeWpUrl(img);
      if (!seen.has(normalized)) {
        seen.add(normalized);
        unique.push(img);
      }
    }

    // Fallback: if scraping returned no images, use listing image (if not a thumbnail)
    if (unique.length === 0 && listingImage && !isThumbnailUrl(listingImage)) {
      unique.push(listingImage);
    }

    return unique;
  }, [details?.images, ad?.image_url]);

  const title = ad?.title ?? details?.title ?? "Annons";
  // Prefer listing price (ad.price_text) as it's synced more frequently
  // Fall back to details price only if listing price is missing
  const priceText = ad?.price_text 
    ? ad.price_text 
    : details?.price_text 
      ? details.price_text 
      : "Pris ej angivet";
  const location = ad?.location ?? details?.location ?? "";
  
  // Show cached description immediately if available, otherwise wait for details
  const description = details?.description 
    ? cleanDescription(details.description, ad) 
    : (hasCachedDescription ? cleanDescription(ad!.description!, ad) : "");

  // Get category info
  const categoryInfo = useMemo(() => {
    if (!ad) return null;
    const internalCat = ad.category && CATEGORIES.some(c => c.id === ad.category)
      ? ad.category
      : mapToInternalCategory(ad.title);
    return CATEGORIES.find(c => c.id === internalCat);
  }, [ad]);

  // Get similar ads (same category, excluding current)
  const similarAds = useMemo(() => {
    if (!ad || !listingsData?.ads || !categoryInfo) return [];
    
    return listingsData.ads
      .filter(a => {
        if (a.ad_url === ad.ad_url) return false;
        const cat = a.category && CATEGORIES.some(c => c.id === a.category)
          ? a.category
          : mapToInternalCategory(a.title);
        return cat === categoryInfo.id;
      })
      .slice(0, 12);
  }, [ad, listingsData?.ads, categoryInfo]);

  const nextImage = () => {
    if (images.length === 0) return;
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    if (images.length === 0) return;
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

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

  // Check if this is a dead link
  const isDeadLink = details?.isDeadLink;

  if (!ad) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex flex-col items-center justify-center p-8 mt-20">
          <p className="text-muted-foreground mb-4">Annonsen hittades inte</p>
          <Button asChild variant="outline">
            <Link to="/">Tillbaka till startsidan</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (isDeadLink) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex flex-col items-center justify-center p-8 mt-20 max-w-md mx-auto text-center">
          <div className="mb-6 p-4 rounded-full bg-destructive/10">
            <ExternalLink className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-xl font-bold mb-2">Annonsen finns inte längre</h1>
          <p className="text-muted-foreground mb-6">
            Denna annons har tagits bort från {sourceInfo.name}. 
            Den kan ha blivit såld eller dragits tillbaka av säljaren.
          </p>
          <div className="flex gap-3">
            <Button asChild variant="outline">
              <Link to="/">Tillbaka till startsidan</Link>
            </Button>
            <Button asChild>
              <a 
                href={ad.ad_url} 
                target="_blank" 
                rel="noopener noreferrer"
                onClick={(e) => handleExternalClick(e, ad.ad_url)}
              >
                Kontrollera på {sourceInfo.name}
              </a>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-8">
      {/* Main Header with Search */}
      <Header />

      {/* Breadcrumb Navigation */}
      <nav className="border-b border-border bg-background">
        <div className="max-w-6xl mx-auto px-4 lg:px-6 py-3">
          <div className="flex items-center gap-2 text-sm">
            <Link 
              to="/" 
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Alla kategorier
            </Link>
            {categoryInfo && (
              <>
                <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
                <Link 
                  to={`/?category=${categoryInfo.id}`}
                  className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
                >
                  <categoryInfo.icon className="h-4 w-4" />
                  {categoryInfo.label}
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="lg:max-w-6xl lg:mx-auto lg:px-6 lg:py-8">
        <div className="lg:grid lg:grid-cols-[1fr_380px] lg:gap-8">
          
          {/* Left Column - Images & Description */}
          <div>
            {/* Image Gallery */}
            <div 
              className="relative bg-secondary aspect-square lg:aspect-[4/3] lg:rounded-xl overflow-hidden group cursor-pointer"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onClick={() => images.length > 0 && setLightboxOpen(true)}
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

              {/* Zoom hint on hover */}
              {images.length > 0 && <ZoomHint />}

              {/* Share button on mobile */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleShare();
                }}
                className="lg:hidden absolute top-4 right-4 h-10 w-10 rounded-full bg-background/80 backdrop-blur flex items-center justify-center"
                aria-label="Dela"
              >
                <Share2 className="h-5 w-5" />
              </button>

              {images.length > 1 && (
                <>
                  {/* Desktop nav buttons */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      prevImage();
                    }}
                    className="hidden lg:flex absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-background/90 backdrop-blur items-center justify-center hover:bg-background transition-colors shadow-lg"
                    aria-label="Föregående bild"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      nextImage();
                    }}
                    className="hidden lg:flex absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-background/90 backdrop-blur items-center justify-center hover:bg-background transition-colors shadow-lg"
                    aria-label="Nästa bild"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>

                  {/* Image counter */}
                  <div className="absolute top-4 left-4 lg:left-auto lg:right-4 bg-background/80 backdrop-blur rounded-full px-3 py-1.5 text-sm font-medium">
                    {currentImageIndex + 1} / {images.length}
                  </div>

                  {/* Dots indicator */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-background/80 backdrop-blur rounded-full px-3 py-2">
                    {images.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentImageIndex(idx);
                        }}
                        className={cn(
                          "h-2 w-2 rounded-full transition-colors",
                          idx === currentImageIndex 
                            ? "bg-primary"
                            : "bg-foreground/30 hover:bg-foreground/50"
                        )}
                        aria-label={`Bild ${idx + 1}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Lightbox */}
            <ImageLightbox
              images={images}
              currentIndex={currentImageIndex}
              isOpen={lightboxOpen}
              onClose={() => setLightboxOpen(false)}
              onNext={nextImage}
              onPrev={prevImage}
              onIndexChange={setCurrentImageIndex}
              title={title}
            />

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
              
              {/* Show description immediately if cached, otherwise show skeleton while loading */}
              {description ? (
                <FormattedDescription text={description} />
              ) : isLoading ? (
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
                <p className="text-muted-foreground leading-relaxed">
                  Ingen beskrivning tillgänglig.
                </p>
              )}
            </div>

            {/* Specifications Table */}
            {details?.specifications && details.specifications.length > 0 && (
              <SpecificationsTable specifications={details.specifications} />
            )}

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
                    <a 
                      href={ad.ad_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      onClick={(e) => handleExternalClick(e, ad.ad_url)}
                    >
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

                  <Button variant="ghost" size="sm" onClick={handleShare} className="w-full gap-2">
                    <Share2 className="h-4 w-4" />
                    Dela annons
                  </Button>
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

        {/* Similar Ads Section */}
        {similarAds.length > 0 && (
          <section className="mt-8 lg:mt-12 px-4 lg:px-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg lg:text-xl font-semibold">Du kanske också gillar</h2>
              {categoryInfo && (
                <Link 
                  to={`/?category=${categoryInfo.id}`}
                  className="text-sm text-primary hover:underline"
                >
                  Visa alla
                </Link>
              )}
            </div>
            <SimilarAdsCarousel ads={similarAds} currentAdUrl={ad.ad_url} />
          </section>
        )}
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
            <a 
              href={ad.ad_url} 
              target="_blank" 
              rel="noopener noreferrer"
              onClick={(e) => handleExternalClick(e, ad.ad_url)}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Visa på {sourceInfo.name}
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
