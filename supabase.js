
/* B.E.R. PLATFORM - Supabase */

(() => {
  const URL = "https://xboncmqpwlciovoaamkb.supabase.co";
  const KEY = "sb_publishable_KHnOQIwnQb7CVPScSh-kiQ_FADp6df-";

  try {
    if (!window.supabase) {
      throw new Error("Bibliothèque Supabase absente");
    }

    if (
      !URL.startsWith("https://") ||
      !URL.endsWith(".supabase.co") ||
      !KEY.startsWith("sb_publishable_")
    ) {
      throw new Error("URL ou clé incomplète ou incorrecte");
    }

    window.berSupabase = window.supabase.createClient(URL, KEY);

    console.log("B.E.R. : client Supabase initialisé.");

  } catch (error) {
    console.error("B.E.R. Supabase :", error.message);
    window.berSupabaseError = error.message;
  }
})();
