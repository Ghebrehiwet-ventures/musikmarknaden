import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { Mail } from "lucide-react";

export default function Kontakt() {
  return (
    <>
      <SEOHead
        title="Kontakt – Musikmarknaden.com"
        description="Kontakta Musikmarknaden. Vi svarar på frågor om tjänsten, annonsrapportering och samarbeten."
      />
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <h1 className="text-2xl sm:text-3xl font-bold mb-6">Kontakt</h1>

          <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none space-y-6 text-muted-foreground">
            <p>
              Musikmarknaden.com drivs av Stora Musikhuset Solutions Stockholm AB.
              Hör av dig om du har frågor, feedback eller vill rapportera en felaktig annons.
            </p>

            <div className="not-prose bg-muted/30 border border-border rounded-lg p-6 space-y-4">
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-foreground">E-post</p>
                  <a href="mailto:hej@musikmarknaden.com" className="text-sm text-primary hover:underline">
                    hej@musikmarknaden.com
                  </a>
                </div>
              </div>
              <div>
                <p className="font-medium text-foreground">Företag</p>
                <p className="text-sm text-muted-foreground">
                  Stora Musikhuset Solutions Stockholm AB
                </p>
                <p className="text-sm text-muted-foreground">
                  Org.nr 559544-7151
                </p>
              </div>
            </div>

            <h2 className="text-lg font-semibold text-foreground">Vanliga frågor</h2>

            <p className="font-medium text-foreground">Kan jag lägga upp en annons på Musikmarknaden?</p>
            <p>
              Nej, Musikmarknaden är en söktjänst som indexerar annonser från andra sajter.
              För att lägga upp en annons, gå till någon av våra källor (t.ex. Blocket, Musikbörsen eller Gearloop).
            </p>

            <p className="font-medium text-foreground">En annons visar fel information — vad gör jag?</p>
            <p>
              Annonsinnehållet hämtas från originalkällan. Om något är fel, kontakta säljaren direkt
              via originalsajten. Om en annons inte borde visas hos oss, mejla oss så tar vi bort den.
            </p>

            <p className="font-medium text-foreground">Hur ofta uppdateras annonserna?</p>
            <p>
              Annonserna synkas flera gånger per dag. Bortagna annonser försvinner normalt
              inom 24 timmar.
            </p>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}
