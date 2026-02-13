import { Link } from "react-router-dom";
import { CATEGORIES } from "@/lib/categories";
import { Music } from "lucide-react";

const SOURCE_LINKS = [
  { name: "Blocket", url: "https://www.blocket.se" },
  { name: "Musikbörsen", url: "https://www.musikborsen.se" },
  { name: "Gearloop", url: "https://gearloop.se" },
  { name: "Jam", url: "https://www.jam.se" },
  { name: "DLX Music", url: "https://www.dlxmusic.se" },
  { name: "Gear4music", url: "https://www.gear4music.se" },
  { name: "Uppsala Musikverkstad", url: "https://www.uppsalamusikverkstad.se" },
];

const POPULAR_SEARCHES = [
  { q: "gitarr stockholm", label: "Gitarr Stockholm" },
  { q: "synth göteborg", label: "Synth Göteborg" },
  { q: "trummor malmö", label: "Trummor Malmö" },
  { q: "elgitarr begagnad", label: "Elgitarr" },
  { q: "keyboard begagnat", label: "Keyboard" },
  { q: "förstärkare", label: "Förstärkare" },
  { q: "pedaler effekter", label: "Pedaler" },
  { q: "bas begagnad", label: "Bas" },
  { q: "studioutrustning", label: "Studio" },
  { q: "fender", label: "Fender" },
  { q: "gibson", label: "Gibson" },
  { q: "roland", label: "Roland" },
];

export function Footer() {
  return (
    <footer className="border-t border-border mt-auto" role="contentinfo">

      {/* Populärt */}
      <div className="border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground shrink-0">
            Populärt
          </span>
          {POPULAR_SEARCHES.map(({ q, label }) => (
            <Link
              key={q}
              to={`/?q=${encodeURIComponent(q)}`}
              className="shrink-0 text-xs px-3 py-1 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* Huvudsektion */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Varumärke – alltid full bredd */}
        <div className="mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 font-semibold text-foreground hover:text-primary transition-colors"
          >
            <Music className="h-5 w-5 shrink-0" aria-hidden />
            Musikmarknaden.com
          </Link>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-md">
            En oberoende söktjänst för begagnad musikutrustning i Sverige. Vi indexerar annonser från publikt tillgängliga källor och länkar vidare till originalannonserna.
          </p>
        </div>

        {/* Länkkolumner */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-8">

          {/* Kategorier – 2 interna kolumner så listan inte blir extremt lång */}
          <nav className="col-span-2" aria-label="Kategorier">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Kategorier
            </h3>
            <ul className="grid grid-cols-2 gap-x-8 gap-y-1.5">
              {CATEGORIES.map((cat) => (
                <li key={cat.id}>
                  <Link
                    to={`/?category=${cat.id}`}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {cat.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Källor */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Källor
            </h3>
            <ul className="space-y-1.5">
              {SOURCE_LINKS.map((s) => (
                <li key={s.name}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {s.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Information */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Information
            </h3>
            <ul className="space-y-1.5">
              <li><Link to="/om" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Om tjänsten</Link></li>
              <li><Link to="/kontakt" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Kontakt</Link></li>
              <li><Link to="/anvandarvillkor" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Villkor</Link></li>
              <li><Link to="/integritetspolicy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Integritet</Link></li>
              <li><Link to="/cookies" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Cookies</Link></li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottenrad */}
      <div className="border-t border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 text-center sm:text-left">
          <span className="text-xs text-muted-foreground">
            © 2026 Musikmarknaden.com · En oberoende söktjänst för begagnad musikutrustning.
          </span>
          <span className="text-xs text-muted-foreground">
            Utvecklad av <a href="https://www.storamusikhuset.se" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors underline">Stora Musikhuset Solutions Stockholm AB</a>
          </span>
        </div>
      </div>
    </footer>
  );
}
