import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { ScrollToTop } from "@/components/ScrollToTop";
import Index from "./pages/Index";
import AdDetails from "./pages/AdDetails";
import NotFound from "./pages/NotFound";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminSources from "./pages/admin/AdminSources";
import AdminCategories from "./pages/admin/AdminCategories";
import AdminLogs from "./pages/admin/AdminLogs";
import OmTjansten from "./pages/OmTjansten";
import Kontakt from "./pages/Kontakt";
import Anvandarvillkor from "./pages/Anvandarvillkor";
import Integritetspolicy from "./pages/Integritetspolicy";
import CookiePolicy from "./pages/CookiePolicy";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/ad/:id" element={<AdDetails />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/" element={<AdminDashboard />} />
            <Route path="/admin/sources" element={<AdminSources />} />
            <Route path="/admin/sources/" element={<AdminSources />} />
            <Route path="/admin/categories" element={<AdminCategories />} />
            <Route path="/admin/categories/" element={<AdminCategories />} />
            <Route path="/admin/logs" element={<AdminLogs />} />
            <Route path="/admin/logs/" element={<AdminLogs />} />
            <Route path="/om" element={<OmTjansten />} />
            <Route path="/kontakt" element={<Kontakt />} />
            <Route path="/anvandarvillkor" element={<Anvandarvillkor />} />
            <Route path="/integritetspolicy" element={<Integritetspolicy />} />
            <Route path="/cookies" element={<CookiePolicy />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
