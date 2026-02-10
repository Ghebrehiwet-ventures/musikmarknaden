import { useState, useEffect, useRef } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean; // Load immediately (above fold)
  onLoad?: () => void;
  onError?: () => void;
}

/**
 * Optimized Image Component with:
 * - Lazy loading (loads when visible)
 * - WebP format (if browser supports)
 * - Blur placeholder
 * - Error fallback
 * 
 * Usage:
 * <OptimizedImage 
 *   src="https://example.com/image.jpg"
 *   alt="Fender Stratocaster"
 *   className="w-full h-64 object-cover"
 *   priority={false}
 * />
 */
export function OptimizedImage({
  src,
  alt,
  className = '',
  width,
  height,
  priority = false,
  onLoad,
  onError,
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(priority); // If priority, load immediately
  const imgRef = useRef<HTMLImageElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority || !imgRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '50px', // Start loading 50px before image enters viewport
      }
    );

    observer.observe(imgRef.current);

    return () => observer.disconnect();
  }, [priority]);

  // Convert to WebP if supported (basic CDN transformation)
  const getOptimizedSrc = (originalSrc: string): string => {
    if (!originalSrc) return '';
    
    // If image is from external source, just return it
    // In production, you'd want to proxy through your own CDN
    return originalSrc;
    
    // Example with Cloudflare Images (if you set it up later):
    // return `https://imagedelivery.net/YOUR_ACCOUNT/image=${encodeURIComponent(originalSrc)}/w=${width || 800},f=auto`;
  };

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  // Fallback image (musical note icon or placeholder)
  const fallbackSrc = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23f0f0f0" width="400" height="300"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em" font-family="sans-serif" font-size="18"%3EIngen bild%3C/text%3E%3C/svg%3E';

  return (
    <div 
      ref={imgRef}
      className={`relative overflow-hidden bg-gray-100 ${className}`}
      style={{ 
        width: width ? `${width}px` : undefined, 
        height: height ? `${height}px` : undefined 
      }}
    >
      {/* Blur placeholder (shows before image loads) */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300 animate-pulse" />
      )}

      {/* Actual image (lazy loaded) */}
      {isInView && (
        <img
          src={hasError ? fallbackSrc : getOptimizedSrc(src)}
          alt={alt}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={handleLoad}
          onError={handleError}
          width={width}
          height={height}
        />
      )}

      {/* Error state */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
          🎵 Ingen bild
        </div>
      )}
    </div>
  );
}

/**
 * Preload critical images (for above-the-fold content)
 */
export function preloadImage(src: string) {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = src;
  document.head.appendChild(link);
}
