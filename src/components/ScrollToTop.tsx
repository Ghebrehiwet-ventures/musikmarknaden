import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * ScrollToTop Component
 * Scrolls to top of page on route change
 * 
 * Usage: Place in App.tsx inside BrowserRouter
 */
export function ScrollToTop() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    // Scroll to top on route or query change (e.g. footer category links ?category=)
    window.scrollTo(0, 0);
  }, [pathname, search]);

  return null;
}
