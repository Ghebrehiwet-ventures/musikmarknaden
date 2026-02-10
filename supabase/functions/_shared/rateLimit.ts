/**
 * Rate Limiting Middleware for Supabase Edge Functions
 * Prevents abuse and scraping attempts
 */

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

// In-memory store (resets on function cold start, which is acceptable)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Check if request should be rate limited
 * Returns true if request should be blocked
 */
export function isRateLimited(
  identifier: string,
  config: RateLimitConfig = { windowMs: 60000, maxRequests: 60 }
): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  // Clean up expired records
  if (record && now > record.resetTime) {
    rateLimitStore.delete(identifier);
  }

  // Get or create record
  const current = rateLimitStore.get(identifier) || {
    count: 0,
    resetTime: now + config.windowMs,
  };

  // Increment counter
  current.count++;
  rateLimitStore.set(identifier, current);

  // Check if limit exceeded
  return current.count > config.maxRequests;
}

/**
 * Get rate limit identifier from request
 * Uses IP address or authorization header
 */
export function getRateLimitIdentifier(req: Request): string {
  // Try to get real IP from headers (Cloudflare, Vercel, etc.)
  const forwardedFor = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const cfConnectingIp = req.headers.get('cf-connecting-ip');
  
  const ip = cfConnectingIp || realIp || forwardedFor?.split(',')[0] || 'unknown';
  
  // Include user agent for better identification
  const userAgent = req.headers.get('user-agent') || 'unknown';
  
  return `${ip}:${userAgent.substring(0, 50)}`;
}

/**
 * Create rate limit response
 */
export function createRateLimitResponse(): Response {
  return new Response(
    JSON.stringify({ 
      error: 'Too many requests. Please try again later.',
      message: 'Rate limit exceeded. Contact support if you believe this is an error.'
    }),
    { 
      status: 429,
      headers: { 
        'Content-Type': 'application/json',
        'Retry-After': '60'
      } 
    }
  );
}

/**
 * Detect potential scraping bots based on user agent and behavior
 */
export function isSuspiciousBot(req: Request): boolean {
  const userAgent = (req.headers.get('user-agent') || '').toLowerCase();
  
  // Known scraper patterns
  const suspiciousPatterns = [
    'scrapy',
    'crawler',
    'spider',
    'scraper',
    'bot',
    'curl',
    'wget',
    'python-requests',
    'selenium',
    'phantomjs',
    'headless',
    'axios',
    'fetch',
    'httpx',
  ];

  // Whitelist legitimate bots
  const legitimateBots = [
    'googlebot',
    'bingbot',
    'slurp', // Yahoo
    'duckduckbot',
    'baiduspider',
    'yandexbot',
  ];

  const isLegitimate = legitimateBots.some(bot => userAgent.includes(bot));
  if (isLegitimate) return false;

  const isSuspicious = suspiciousPatterns.some(pattern => userAgent.includes(pattern));
  
  // Also check for missing or very short user agents (common in bots)
  const hasMinimalUserAgent = !userAgent || userAgent.length < 20;
  
  return isSuspicious || hasMinimalUserAgent;
}
