import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";

export default function Anvandarvillkor() {
  return (
    <>
      <SEOHead
        title="Användarvillkor – Musikmarknaden.com"
        description="Läs användarvillkoren för Musikmarknaden.com. Villkor för användning av tjänsten."
      />
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Användarvillkor</h1>
          <p className="text-sm text-muted-foreground mb-8">Senast uppdaterad: 13 februari 2026</p>

          <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none space-y-6 text-muted-foreground">

            <h2 className="text-lg font-semibold text-foreground">1. Om tjänsten</h2>
            <p>
              Musikmarknaden.com ("Tjänsten") drivs av Stora Musikhuset Solutions Stockholm AB,
              org.nr 559544-7151 ("vi", "oss"). Tjänsten är en söktjänst som indexerar publikt
              tillgängliga annonser för musikutrustning från tredjepartskällor och gör dem sökbara
              på en samlad plats.
            </p>

            <h2 className="text-lg font-semibold text-foreground">2. Användning</h2>
            <p>
              Genom att använda Tjänsten godkänner du dessa villkor. Tjänsten tillhandahålls
              i befintligt skick och är gratis att använda. Du får använda Tjänsten för personligt,
              icke-kommersiellt bruk.
            </p>
            <p>
              Du får inte:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Automatiserat skrapa eller kopiera innehåll från Tjänsten.</li>
              <li>Använda Tjänsten för att skapa konkurrerande tjänster.</li>
              <li>Försöka kringgå tekniska skyddsåtgärder.</li>
            </ul>

            <h2 className="text-lg font-semibold text-foreground">3. Annonsinnehåll</h2>
            <p>
              Musikmarknaden lagrar inte annonser. Vi indexerar och länkar till publikt tillgängliga
              annonser som tillhör respektive källa och säljare. Vi ansvarar inte för:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Riktigheten i annonsernas innehåll, priser eller bilder.</li>
              <li>Tillgängligheten av annonser som länkas till.</li>
              <li>Transaktioner eller avtal mellan köpare och säljare.</li>
            </ul>
            <p>
              Om du anser att en annons inte borde visas, kontakta oss
              på <a href="mailto:hej@musikmarknaden.com" className="text-primary hover:underline">hej@musikmarknaden.com</a> så
              tar vi bort den.
            </p>

            <h2 className="text-lg font-semibold text-foreground">4. Ansvarsfriskrivning</h2>
            <p>
              Tjänsten tillhandahålls utan garantier av något slag. Vi ansvarar inte för
              direkta eller indirekta skador som uppstår genom användning av Tjänsten, inklusive
              men inte begränsat till felaktiga annonsuppgifter, driftstopp eller förlust av data.
            </p>
            <p>
              Vi garanterar inte att alla annonser är aktuella, korrekta eller fullständiga.
              Kontrollera alltid informationen på originalkällan innan du genomför ett köp.
            </p>

            <h2 className="text-lg font-semibold text-foreground">5. Tredjepartslänkar</h2>
            <p>
              Tjänsten innehåller länkar till tredjepartssajter. Vi ansvarar inte för
              innehållet på, eller hanteringen av personuppgifter hos, dessa sajter.
              Deras egna villkor och policyer gäller.
            </p>

            <h2 className="text-lg font-semibold text-foreground">6. Ändringar</h2>
            <p>
              Vi förbehåller oss rätten att när som helst ändra dessa villkor. Väsentliga
              ändringar meddelas på denna sida. Fortsatt användning av Tjänsten efter en ändring
              innebär att du godkänner de nya villkoren.
            </p>

            <h2 className="text-lg font-semibold text-foreground">7. Kontakt</h2>
            <p>
              Frågor om dessa villkor? Kontakta oss
              på <a href="mailto:hej@musikmarknaden.com" className="text-primary hover:underline">hej@musikmarknaden.com</a>.
            </p>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}
