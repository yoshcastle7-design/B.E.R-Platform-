/* B.E.R. PLATFORM — AUTHENTIFICATION */

(() => {
  console.log("BER AUTH : démarrage");

  if (!window.berSupabase) {
    console.error("Client Supabase absent.");
    return;
  }

  const client = window.berSupabase;

  window.berAuth = {
    async signUp(email, password) {
      return await client.auth.signUp({
        email: email.trim(),
        password
      });
    },

    async signIn(email, password) {
      return await client.auth.signInWithPassword({
        email: email.trim(),
        password
      });
    },

    async signOut() {
      return await client.auth.signOut();
    },

    async resetPassword(email) {
      return await client.auth.resetPasswordForEmail(email.trim());
    },

    async getSession() {
      return await client.auth.getSession();
    },

    onAuthChange(callback) {
      return client.auth.onAuthStateChange(callback);
    }
  };

  console.log("BER AUTH : module initialisé");
})();