
/* =========================================
   B.E.R. PLATFORM — AUTHENTIFICATION
   Version 0.0.0.1
========================================= */

(() => {
  "use strict";

  // =========================================
  // 1. ÉLÉMENTS HTML
  // =========================================

  const message = document.getElementById("authMessage");

  const formConnexion = document.getElementById("formConnexion");
  const formInscription = document.getElementById("formInscription");

  const tabConnexion = document.getElementById("tabConnexion");
  const tabInscription = document.getElementById("tabInscription");

  const emailConnexion = document.getElementById("emailConnexion");
  const passwordConnexion = document.getElementById("passwordConnexion");

  const emailInscription = document.getElementById("emailInscription");
  const passwordInscription = document.getElementById("passwordInscription");

  const forgotPassword = document.getElementById("forgotPassword");

  // =========================================
  // 2. SERVICES
  // =========================================

  const client = window.berSupabase;
  const auth = window.berAuth;

  let connexionEnCours = false;
  let inscriptionEnCours = false;
  let recuperationEnCours = false;

  // =========================================
  // 3. FONCTIONS GÉNÉRALES
  // =========================================

  function afficherMessage(texte, type = "info") {
    if (!message) return;

    message.replaceChildren();
    message.textContent = texte;

    message.dataset.type = type;
  }

  function obtenirAdresse(fichier) {
    return new URL(fichier, document.baseURI).href;
  }

  function afficherConnexion() {
    formConnexion.hidden = false;
    formInscription.hidden = true;

    tabConnexion?.classList.add("active");
    tabInscription?.classList.remove("active");

    afficherMessage("");
  }

  function afficherInscription() {
    formConnexion.hidden = true;
    formInscription.hidden = false;

    tabConnexion?.classList.remove("active");
    tabInscription?.classList.add("active");

    afficherMessage("");
  }

  function afficherLienDashboard() {
    const lien = document.createElement("a");

    lien.href = obtenirAdresse("dashboard.html");
    lien.textContent = "Ouvrir mon Dashboard";
    lien.style.display = "inline-block";
    lien.style.marginTop = "12px";
    lien.style.padding = "12px 20px";
    lien.style.background = "#2563eb";
    lien.style.color = "#ffffff";
    lien.style.borderRadius = "10px";
    lien.style.textDecoration = "none";

    message.appendChild(document.createElement("br"));
    message.appendChild(lien);
  }

  function gererErreur(error, operation) {
    console.error("B.E.R. " + operation + " :", error);

    afficherMessage(
      error?.message || "Une erreur inattendue est survenue.",
      "error"
    );
  }

  // =========================================
  // 4. VÉRIFICATIONS
  // =========================================

  if (
    !message ||
    !formConnexion ||
    !formInscription ||
    !emailConnexion ||
    !passwordConnexion ||
    !emailInscription ||
    !passwordInscription
  ) {
    console.error("B.E.R. : éléments HTML manquants.");
    return;
  }

  if (!client || !auth) {
    afficherMessage(
      "Erreur : service d'authentification indisponible.",
      "error"
    );

    console.error("B.E.R. : client Supabase indisponible.");
    return;
  }

  // =========================================
  // 5. NAVIGATION
  // =========================================

  tabConnexion?.addEventListener("click", afficherConnexion);
  tabInscription?.addEventListener("click", afficherInscription);

  // =========================================
  // 6. CONNEXION
  // =========================================

  formConnexion.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (connexionEnCours) return;

    const email = emailConnexion.value.trim();
    const password = passwordConnexion.value;

    if (!email || !password) {
      afficherMessage("Veuillez remplir tous les champs.", "error");
      return;
    }

    connexionEnCours = true;

    const bouton = formConnexion.querySelector(
      'button[type="submit"]'
    );

    if (bouton) bouton.disabled = true;

    afficherMessage("Connexion en cours...");

    try {
      // Authentification Supabase
      const resultat = await auth.signIn(email, password);

      if (resultat?.error) {
        throw resultat.error;
      }

      // Vérification de la session
      const verification = await client.auth.getSession();

      if (verification.error) {
        throw verification.error;
      }

      if (!verification.data?.session) {
        throw new Error("La session utilisateur n'a pas été créée.");
      }

      afficherMessage(
        "Connexion réussie ! Préparation de votre espace..."
      );

      console.log("B.E.R. : session confirmée.");

      // Préparer le lien de destination
      const destination = obtenirAdresse("dashboard.html");

      console.log("B.E.R. : destination =", destination);

      // Afficher un lien de secours
      afficherLienDashboard();

      // Redirection automatique
      window.setTimeout(() => {
        window.location.href = destination;
      }, 1000);

    } catch (error) {
      gererErreur(error, "CONNEXION");

      connexionEnCours = false;

      if (bouton) bouton.disabled = false;
    }
  });

  // =========================================
  // 7. INSCRIPTION
  // =========================================

  formInscription.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (inscriptionEnCours) return;

    const email = emailInscription.value.trim();
    const password = passwordInscription.value;

    if (!email || !password) {
      afficherMessage("Veuillez remplir tous les champs.", "error");
      return;
    }

    if (password.length < 6) {
      afficherMessage(
        "Le mot de passe doit contenir au moins 6 caractères.",
        "error"
      );
      return;
    }

    inscriptionEnCours = true;

    const bouton = formInscription.querySelector(
      'button[type="submit"]'
    );

    if (bouton) bouton.disabled = true;

    afficherMessage("Création de votre compte...");

    try {
      const resultat = await auth.signUp(email, password);

      if (resultat?.error) {
        throw resultat.error;
      }

      afficherMessage(
        "Inscription réussie ! Vérifiez votre e-mail si une confirmation est demandée.",
        "success"
      );

      formInscription.reset();

    } catch (error) {
      gererErreur(error, "INSCRIPTION");

    } finally {
      inscriptionEnCours = false;

      if (bouton) bouton.disabled = false;
    }
  });

  // =========================================
  // 8. MOT DE PASSE OUBLIÉ
  // =========================================

  forgotPassword?.addEventListener("click", async (event) => {
    event.preventDefault();

    if (recuperationEnCours) return;

    const email = emailConnexion.value.trim();

    if (!email) {
      afficherMessage(
        "Saisissez d'abord votre adresse e-mail.",
        "error"
      );

      emailConnexion.focus();
      return;
    }

    recuperationEnCours = true;

    afficherMessage("Envoi du lien de récupération...");

    try {
      const resultat = await client.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: obtenirAdresse("login.html")
        }
      );

      if (resultat.error) {
        throw resultat.error;
      }

      afficherMessage(
        "Si cette adresse est enregistrée, un lien de récupération sera envoyé.",
        "success"
      );

    } catch (error) {
      gererErreur(error, "RÉCUPÉRATION");

    } finally {
      recuperationEnCours = false;
    }
  });

  // =========================================
  // 9. INITIALISATION
  // =========================================

  afficherConnexion();

  console.log("B.E.R. : authentification initialisée.");

})();
