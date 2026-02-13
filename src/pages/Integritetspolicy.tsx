import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";

export default function Integritetspolicy() {
  return (
    <>
      <SEOHead
        title="Integritetspolicy – Musikmarknaden.com"
        description="Så hanterar Musikmarknaden dina personuppgifter. Läs vår integritetspolicy."
      />
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Integritetspolicy</h1>
          <p className="text-sm text-muted-foreground mb-8">Senast uppdaterad: 13 februari 2026</p>

          <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none space-y-6 text-muted-foreground">

            <h2 className="text-lg font-semibold text-foreground">1. Personuppgiftsansvarig</h2>
            <p>
              Stora Musikhuset Solutions Stockholm AB, org.nr 559544-7151, är personuppgiftsansvarig
              för behandlingen av personuppgifter i samband med Musikmarknaden.com ("Tjänsten").
            </p>
            <p>
              Kontakt: <a href="mailto:hej@musikmarknaden.com" className="text-primary hover:underline">hej@musikmarknaden.com</a>
            </p>

            <h2 className="text-lg font-semibold text-foreground">2. Vilka uppgifter samlar vi in?</h2>
            <p>
              Musikmarknaden kräver ingen registrering och vi samlar inte aktivt in personuppgifter.
              Följande uppgifter kan dock behandlas automatiskt:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-foreground">Teknisk data:</strong> IP-adress, webbläsartyp, operativsystem och besökta sidor. Denna data samlas in via serverloggar och används för att säkerställa driften.</li>
              <li><strong className="text-foreground">Cookies:</strong> Vi använder nödvändiga cookies för att Tjänsten ska fungera. Se vår <a href="/cookies" className="text-primary hover:underline">cookiepolicy</a> för mer information.</li>
            </ul>

            <h2 className="text-lg font-semibold text-foreground">3. Rättslig grund</h2>
            <p>
              Vi behandlar teknisk data baserat på berättigat intresse (GDPR artikel 6.1f)
              — att driva och skydda Tjänsten. Vi behandlar cookies baserat på ditt samtycke
              när det gäller icke-nödvändiga cookies.
            </p>

            <h2 className="text-lg font-semibold text-foreground">4. Delning med tredje part</h2>
            <p>
              Vi säljer aldrig personuppgifter. Teknisk data kan delas med:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-foreground">Vercel</strong> — hosting och leverans av webbsidor.</li>
              <li><strong className="text-foreground">Supabase</strong> — databashantering och serverlogik.</li>
            </ul>
            <p>
              Dessa underleverantörer behandlar data inom EU/EES eller under adekvata skyddsmekanismer.
            </p>

            <h2 className="text-lg font-semibold text-foreground">5. Lagring</h2>
            <p>
              Serverloggar sparas i maximalt 90 dagar. Cookies har varierande livslängd
              — se vår <a href="/cookies" className="text-primary hover:underline">cookiepolicy</a>.
            </p>

            <h2 className="text-lg font-semibold text-foreground">6. Dina rättigheter</h2>
            <p>
              Enligt GDPR har du rätt att:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Begära tillgång till de uppgifter vi har om dig.</li>
              <li>Begära rättelse eller radering av uppgifter.</li>
              <li>Invända mot eller begränsa behandlingen.</li>
              <li>Lämna klagomål till Integritetsskyddsmyndigheten (IMY).</li>
            </ul>
            <p>
              Kontakta oss på <a href="mailto:hej@musikmarknaden.com" className="text-primary hover:underline">hej@musikmarknaden.com</a> för
              att utöva dina rättigheter.
            </p>

            <h2 className="text-lg font-semibold text-foreground">7. Ändringar</h2>
            <p>
              Vi kan uppdatera denna policy. Väsentliga ändringar meddelas på denna sida.
            </p>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}
