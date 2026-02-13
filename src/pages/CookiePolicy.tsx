import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";

export default function CookiePolicy() {
  return (
    <>
      <SEOHead
        title="Cookies – Musikmarknaden.com"
        description="Information om hur Musikmarknaden.com använder cookies."
      />
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Cookiepolicy</h1>
          <p className="text-sm text-muted-foreground mb-8">Senast uppdaterad: 13 februari 2026</p>

          <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none space-y-6 text-muted-foreground">

            <h2 className="text-lg font-semibold text-foreground">Vad är cookies?</h2>
            <p>
              Cookies är små textfiler som lagras i din webbläsare när du besöker en webbplats.
              De används för att webbplatsen ska fungera korrekt och för att förbättra
              användarupplevelsen.
            </p>

            <h2 className="text-lg font-semibold text-foreground">Cookies vi använder</h2>
            <p>
              Musikmarknaden.com använder för närvarande enbart nödvändiga cookies:
            </p>

            <div className="not-prose overflow-x-auto">
              <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-4 py-2 font-medium text-foreground border-b border-border">Cookie</th>
                    <th className="text-left px-4 py-2 font-medium text-foreground border-b border-border">Syfte</th>
                    <th className="text-left px-4 py-2 font-medium text-foreground border-b border-border">Typ</th>
                    <th className="text-left px-4 py-2 font-medium text-foreground border-b border-border">Livslängd</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b border-border">
                    <td className="px-4 py-2 font-mono text-xs">sb-*-auth-token</td>
                    <td className="px-4 py-2">Autentisering (admin)</td>
                    <td className="px-4 py-2">Nödvändig</td>
                    <td className="px-4 py-2">Session</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="px-4 py-2 font-mono text-xs">theme</td>
                    <td className="px-4 py-2">Sparar ljust/mörkt tema</td>
                    <td className="px-4 py-2">Nödvändig</td>
                    <td className="px-4 py-2">1 år</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h2 className="text-lg font-semibold text-foreground">Tredjepartscookies</h2>
            <p>
              Vi använder för närvarande inga tredjepartscookies (t.ex. Google Analytics eller
              annonsnätverk). Om detta ändras i framtiden uppdateras denna sida och du
              ombeds ge ditt samtycke innan sådana cookies placeras.
            </p>

            <h2 className="text-lg font-semibold text-foreground">Hantera cookies</h2>
            <p>
              Du kan när som helst radera eller blockera cookies via din webbläsares inställningar.
              Observera att nödvändiga cookies behövs för att vissa funktioner ska fungera
              (t.ex. temaval och admin-inloggning).
            </p>
            <p>
              Vanliga webbläsare:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google Chrome</a></li>
              <li><a href="https://support.mozilla.org/sv/kb/rensa-kakor-och-webbplatsdata-firefox" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Firefox</a></li>
              <li><a href="https://support.apple.com/sv-se/guide/safari/sfri11471/mac" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Safari</a></li>
            </ul>

            <h2 className="text-lg font-semibold text-foreground">Kontakt</h2>
            <p>
              Frågor om cookies? Kontakta oss
              på <a href="mailto:hej@musikmarknaden.com" className="text-primary hover:underline">hej@musikmarknaden.com</a>.
            </p>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}
