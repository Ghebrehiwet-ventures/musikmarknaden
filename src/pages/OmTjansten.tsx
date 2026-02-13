import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";

export default function OmTjansten() {
  return (
    <>
      <SEOHead
        title="Om tjänsten – Musikmarknaden.com"
        description="Musikmarknaden är en oberoende söktjänst för begagnad musikutrustning i Sverige. Läs mer om hur tjänsten fungerar."
      />
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <h1 className="text-2xl sm:text-3xl font-bold mb-6">Om Musikmarknaden</h1>

          <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none space-y-6 text-muted-foreground">
            <p>
              Musikmarknaden.com är en oberoende söktjänst som samlar begagnad musikutrustning
              från flera av Sveriges största annonsplatser på ett och samma ställe. Tjänsten drivs
              av <strong className="text-foreground">Stora Musikhuset Solutions Stockholm AB</strong> (org.nr 559544-7151).
            </p>

            <h2 className="text-lg font-semibold text-foreground">Så fungerar det</h2>
            <p>
              Vi indexerar publikt tillgängliga annonser från sajter som Blocket, Musikbörsen,
              Gearloop, Jam, DLX Music, Gear4music och Uppsala Musikverkstad. Annonserna lagras
              inte hos oss — vi länkar vidare till originalkällan där du kan kontakta säljaren
              och genomföra köpet.
            </p>

            <h2 className="text-lg font-semibold text-foreground">Varför Musikmarknaden?</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Sök igenom tusentals annonser från en plats istället för att besöka varje sajt separat.</li>
              <li>Filtrera på kategori, pris och plats för att snabbt hitta rätt.</li>
              <li>Annonserna uppdateras flera gånger dagligen.</li>
              <li>Helt gratis att använda — inga konton, inga avgifter.</li>
            </ul>

            <h2 className="text-lg font-semibold text-foreground">Oberoende</h2>
            <p>
              Musikmarknaden har inga kommersiella samarbeten med de sajter vi indexerar.
              Vi är en fristående söktjänst och tar inte provision på köp eller försäljning.
              Alla annonser tillhör respektive källa och säljare.
            </p>

            <h2 className="text-lg font-semibold text-foreground">Kontakt</h2>
            <p>
              Har du frågor, feedback eller vill rapportera en annons? Kontakta oss
              på <a href="mailto:hej@musikmarknaden.com" className="text-primary hover:underline">hej@musikmarknaden.com</a>.
            </p>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}
