import { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Send } from "lucide-react";

const CONTACT_FORM_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/contact-form`;

export default function Kontakt() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    setErrorMessage("");

    try {
      const res = await fetch(CONTACT_FORM_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ name, email, subject: subject || undefined, message }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStatus("error");
        setErrorMessage(data.error || "Kunde inte skicka. Försök igen.");
        return;
      }

      setStatus("success");
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
    } catch {
      setStatus("error");
      setErrorMessage("Nätverksfel. Försök igen.");
    }
  };

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
              Skicka ett meddelande om du har frågor, feedback eller vill rapportera en felaktig annons.
            </p>

            <form onSubmit={handleSubmit} className="not-prose space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="contact-name">Namn *</Label>
                <Input
                  id="contact-name"
                  type="text"
                  required
                  minLength={2}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ditt namn"
                  className="max-w-md"
                  disabled={status === "sending"}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="contact-email">E-post *</Label>
                <Input
                  id="contact-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="din@epost.se"
                  className="max-w-md"
                  disabled={status === "sending"}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="contact-subject">Ämne</Label>
                <Input
                  id="contact-subject"
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="T.ex. Felaktig annons, Samarbete"
                  className="max-w-md"
                  disabled={status === "sending"}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="contact-message">Meddelande *</Label>
                <textarea
                  id="contact-message"
                  required
                  minLength={10}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Skriv ditt meddelande..."
                  rows={5}
                  className="flex min-h-[120px] w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={status === "sending"}
                />
              </div>
              {status === "success" && (
                <p className="text-sm text-green-600 dark:text-green-400">
                  Tack! Vi återkommer så snart vi kan.
                </p>
              )}
              {status === "error" && errorMessage && (
                <p className="text-sm text-destructive">{errorMessage}</p>
              )}
              <Button type="submit" disabled={status === "sending"}>
                {status === "sending" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Skickar...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Skicka
                  </>
                )}
              </Button>
            </form>

            <div className="not-prose bg-muted/30 border border-border rounded-lg p-6 mt-8">
              <p className="font-medium text-foreground">Företag</p>
              <p className="text-sm text-muted-foreground">
                Stora Musikhuset Solutions Stockholm AB
              </p>
              <p className="text-sm text-muted-foreground">Org.nr 559544-7151</p>
            </div>

            <h2 className="text-lg font-semibold text-foreground mt-10">Vanliga frågor</h2>

            <p className="font-medium text-foreground">Kan jag lägga upp en annons på Musikmarknaden?</p>
            <p>
              Nej, Musikmarknaden är en söktjänst som indexerar annonser från andra sajter.
              För att lägga upp en annons, gå till någon av våra källor (t.ex. Blocket, Musikbörsen eller Gearloop).
            </p>

            <p className="font-medium text-foreground">En annons visar fel information — vad gör jag?</p>
            <p>
              Annonsinnehållet hämtas från originalkällan. Om något är fel, kontakta säljaren direkt
              via originalsajten. Om en annons inte borde visas hos oss, skicka ett meddelande via formuläret ovan så tar vi bort den.
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
