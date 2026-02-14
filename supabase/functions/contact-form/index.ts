import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const subject = typeof body.subject === "string" ? body.subject.trim() : null;
    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (!name || name.length < 2) {
      return new Response(
        JSON.stringify({ error: "Namn krävs (minst 2 tecken)." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ error: "Ogiltig e-postadress." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!message || message.length < 10) {
      return new Response(
        JSON.stringify({ error: "Meddelande krävs (minst 10 tecken)." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error } = await supabase.from("contact_submissions").insert({
      name: name.slice(0, 500),
      email: email.slice(0, 255),
      subject: subject ? subject.slice(0, 255) : null,
      message: message.slice(0, 10000),
    });

    if (error) {
      console.error("Contact form insert error:", error);
      return new Response(
        JSON.stringify({ error: "Kunde inte skicka. Försök igen senare." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send email notification to hej@musikmarknaden.com via Resend
    // Resend kräver verifierad domän för att skicka till andra – sätt RESEND_FROM till t.ex. "Kontakt <noreply@musikmarknaden.com>" efter domänverifiering
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("RESEND_FROM") || "Kontakt Musikmarknaden <noreply@musikmarknaden.com>";
    if (resendKey) {
      const emailSubject = subject ? `Kontakt: ${subject}` : "Nytt meddelande från kontaktformuläret";
      const emailBody = `Namn: ${name}\nE-post: ${email}\n${subject ? `Ämne: ${subject}\n` : ""}\nMeddelande:\n${message}`;
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${resendKey}`,
          },
          body: JSON.stringify({
            from: fromEmail,
            to: ["hej@musikmarknaden.com"],
            subject: emailSubject,
            text: emailBody,
            reply_to: email,
          }),
        });
        if (!res.ok) {
          const err = await res.text();
          console.error("Resend error:", res.status, err);
        }
      } catch (e) {
        console.error("Failed to send notification email:", e);
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: "Tack! Vi återkommer så snart vi kan." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Contact form error:", e);
    return new Response(
      JSON.stringify({ error: "Ett fel uppstod. Försök igen." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
