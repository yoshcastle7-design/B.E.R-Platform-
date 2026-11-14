
// ==================================================
// B.E.R. PLATFORM — SCRIPT PRINCIPAL
// Version : 0.0.0.1
// ==================================================


// 1. ELEMENTS PRINCIPAUX

const themeToggle = document.getElementById("themeToggle");
const exploreBtn = document.getElementById("exploreBtn");
const dynamicContent = document.getElementById("dynamicContent");
const menuToggle = document.getElementById("menuToggle");
const mainNav = document.getElementById("mainNav");


// 2. MODE SOMBRE / CLAIR

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark");

    const darkMode = document.body.classList.contains("dark");

    themeToggle.textContent = darkMode ? "☀️" : "🌙";

    localStorage.setItem(
      "ber-theme",
      darkMode ? "dark" : "light"
    );
  });

  if (localStorage.getItem("ber-theme") === "dark") {
    document.body.classList.add("dark");
    themeToggle.textContent = "☀️";
  }
}


// 3. BOUTON EXPLORER

if (exploreBtn) {
  exploreBtn.addEventListener("click", () => {
    const universesSection = document.getElementById("universes");

    if (universesSection) {
      universesSection.scrollIntoView({
        behavior: "smooth"
      });
    }
  });
}


// 4. DONNEES DES TROIS UNIVERS

const universes = {
  business: {
    icon: "💼",
    title: "B.E.R. Business",
    description: "Développez vos activités et vos projets.",
    features: [
      "Marketplace et boutiques",
      "Gestion des produits",
      "Gestion des commandes",
      "Crowdfunding : dons et récompenses",
      "Marketing et gestion de projet"
    ]
  },

  education: {
    icon: "🎓",
    title: "B.E.R. Education",
    description: "Apprenez et développez vos compétences.",
    features: [
      "Cours et formations",
      "Quiz quotidiens",
      "Documents pédagogiques",
      "Tutoriels et exercices",
      "Assistant B.E.R. AI"
    ]
  },

  relations: {
    icon: "🤝",
    title: "B.E.R. Relations",
    description: "Développez votre réseau professionnel.",
    features: [
      "Offres d'emploi au Burkina Faso",
      "Recrutement et candidatures",
      "Événements et rencontres",
      "Communauté professionnelle",
      "Lives et conférences"
    ]
  }
};


// 5. AFFICHAGE D'UN UNIVERS

function afficherUnivers(section) {
  const universe = universes[section];

  if (!universe || !dynamicContent) return;

  dynamicContent.innerHTML = `
    <div class="card-icon">${universe.icon}</div>

    <h2>${universe.title}</h2>

    <p>${universe.description}</p>

    <ul class="feature-list">
      ${universe.features.map(feature =>
        `<li>${feature}</li>`
      ).join("")}
    </ul>

    <button id="backHome" class="primary-btn">
      Retour à l'accueil
    </button>
  `;

  document.getElementById("backHome").addEventListener("click", () => {
    afficherAccueil();
  });

  dynamicContent.scrollIntoView({
    behavior: "smooth"
  });
}


// 6. PAGE D'ACCUEIL DYNAMIQUE

function afficherAccueil() {
  if (!dynamicContent) return;

  dynamicContent.innerHTML = `
    <h2>Bienvenue sur B.E.R. Platform</h2>
    <p>Choisissez un univers pour commencer.</p>
  `;

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


// 7. BOUTONS DES UNIVERS

document.querySelectorAll("[data-section]").forEach(button => {
  button.addEventListener("click", () => {
    afficherUnivers(button.dataset.section);
  });
});


// 8. MENU MOBILE

if (menuToggle && mainNav) {
  menuToggle.addEventListener("click", () => {
    mainNav.classList.toggle("open");

    menuToggle.textContent =
      mainNav.classList.contains("open") ? "✕" : "☰";
  });
}


// 9. FERMETURE DU MENU MOBILE

document.querySelectorAll(".nav-link").forEach(link => {
  link.addEventListener("click", () => {
    if (mainNav) mainNav.classList.remove("open");
    if (menuToggle) menuToggle.textContent = "☰";

    document.querySelectorAll(".nav-link").forEach(item => {
      item.classList.remove("active");
    });

    link.classList.add("active");
  });
});


// 10. B.E.R. AI STUDIO

function afficherAIStudio() {
  if (!dynamicContent) return;

  dynamicContent.innerHTML = `
    <section class="ber-ai-studio" id="ber-ai-assistant">

      <div class="card-icon">🤖</div>

      <h2>B.E.R. AI Studio</h2>

      <p>
        Votre assistant intelligent pour apprendre,
        entreprendre et développer vos projets.
      </p>

      <div class="ber-ai-chat">

        <div class="ber-ai-messages" id="aiMessages">

          <div class="ber-ai-welcome">
            <strong>B.E.R. AI</strong>

            <p>
              Bienvenue dans votre espace intelligent.
              Posez vos questions sur Business,
              Éducation ou Relations professionnelles.
            </p>
          </div>

        </div>

        <form id="aiForm">

          <label for="aiQuestion">Votre message</label>

          <textarea
            id="aiQuestion"
            placeholder="Écrivez votre question..."
            rows="3"
            maxlength="4000"
            required
          ></textarea>

          <button type="submit" class="primary-btn">
            Envoyer
          </button>

        </form>

        <p id="aiStatus">
          Connectez-vous pour utiliser B.E.R. AI.
        </p>

      </div>
    </section>
  `;

  const aiForm = document.getElementById("aiForm");
  const aiQuestion = document.getElementById("aiQuestion");
  const aiMessages = document.getElementById("aiMessages");
  const aiStatus = document.getElementById("aiStatus");

  // ENVOI D'UN MESSAGE A GEMINI

  aiForm.addEventListener("submit", async event => {
    event.preventDefault();

    const question = aiQuestion.value.trim();

    if (!question) return;

    const client = window.berSupabase;

    if (!client) {
      aiStatus.textContent =
        "Connexion Supabase indisponible.";
      return;
    }

    const sendButton = aiForm.querySelector("button");

    sendButton.disabled = true;

    try {
      aiStatus.textContent = "Vérification de votre connexion...";

      const { data: sessionData, error: sessionError } =
        await client.auth.getSession();

      if (sessionError) throw sessionError;

      if (!sessionData.session) {
        aiStatus.textContent =
          "Connectez-vous pour utiliser B.E.R. AI.";

        return;
      }

      const userMessage = document.createElement("div");
      userMessage.className = "ber-ai-user-message";
      userMessage.textContent = question;

      aiMessages.appendChild(userMessage);

      aiQuestion.value = "";

      aiStatus.textContent = "B.E.R. AI réfléchit...";

      const { data, error } = await client.functions.invoke(
        "ber-ai-chat",
        {
          body: {
            message: question
          }
        }
      );

      if (error) throw error;

      if (!data || !data.answer) {
        throw new Error("Réponse IA absente.");
      }

      const answer = document.createElement("div");
      answer.className = "ber-ai-assistant-message";
      answer.textContent = data.answer;

      aiMessages.appendChild(answer);

      aiStatus.textContent = "B.E.R. AI est prêt.";

    } catch (error) {
      console.error("B.E.R. AI :", error);

      aiStatus.textContent =
        "Erreur de connexion. Vérifiez Supabase et Gemini.";

    } finally {
      sendButton.disabled = false;
      aiMessages.scrollTop = aiMessages.scrollHeight;
    }
  });

  dynamicContent.scrollIntoView({
    behavior: "smooth"
  });
}


// 10B. B.E.R. MARKETPLACE — PREMIERE INTERFACE

function afficherMarketplace() {
  if (!dynamicContent) return;

  dynamicContent.innerHTML = `
    <section class="ber-marketplace">

      <div class="card-icon">🛍️</div>

      <h2>B.E.R. Marketplace</h2>

      <p>
        Découvrez les produits et les boutiques
        des entreprises et vendeurs individuels.
      </p>

      <div class="marketplace-search">
        <input
          type="search"
          id="marketplaceSearch"
          placeholder="Rechercher un produit..."
          aria-label="Rechercher un produit"
        >
        <button type="button" id="marketplaceSearchBtn">
          🔍 Rechercher
        </button>
      </div>

      <div class="marketplace-categories">

        <button type="button" data-category="all">
          Tout
        </button>

        <button type="button" data-category="electronics">
          Électronique
        </button>

        <button type="button" data-category="clothing">
          Vêtements
        </button>

        <button type="button" data-category="food">
          Alimentation
        </button>

        <button type="button" data-category="services">
          Services
        </button>

      </div>

      <div class="marketplace-results" id="marketplaceResults">

        <div class="ber-marketplace-empty">
          <div class="card-icon">🏪</div>

          <h3>Bienvenue au Marketplace</h3>

          <p>
            Les produits des boutiques apparaîtront ici
            après connexion au catalogue.
          </p>

        </div>

      </div>

    </section>
  `;

  const searchBtn =
    document.getElementById("marketplaceSearchBtn");

  searchBtn.addEventListener("click", () => {
    const search =
      document.getElementById("marketplaceSearch").value.trim();

    console.log("Recherche Marketplace :", search);
  });

  document.querySelectorAll(
    ".marketplace-categories button"
  ).forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll(
        ".marketplace-categories button"
      ).forEach(item => {
        item.classList.remove("active");
      });

      button.classList.add("active");

      console.log(
        "Catégorie Marketplace :",
        button.dataset.category
      );
    });
  });

  dynamicContent.scrollIntoView({
    behavior: "smooth"
  });
}


// 11. NAVIGATION PRINCIPALE

document.querySelectorAll("[data-nav]").forEach(link => {

  link.addEventListener("click", event => {

    event.preventDefault();

    const section = link.dataset.nav;

    if (section === "home") {
      afficherAccueil();

    } else if (universes[section]) {
      afficherUnivers(section);

    } else if (section === "ai") {
      afficherAIStudio();

    } else if (section === "marketplace") {
      afficherMarketplace();
    }

    if (mainNav) {
      mainNav.classList.remove("open");
    }

    if (menuToggle) {
      menuToggle.textContent = "☰";
    }

    document.querySelectorAll(".nav-link").forEach(item => {
      item.classList.remove("active");
    });

    link.classList.add("active");

  });

});



// 12. OUVERTURE AUTOMATIQUE DE B.E.R. AI

if (window.location.hash === "#dynamicContent") {

  const aiLink = document.querySelector('[data-nav="ai"]');

  if (aiLink) {
    aiLink.click();
  }

}


// 13. INITIALISATION

console.log("B.E.R. Platform initialisée !");
console.log("B.E.R. AI Studio chargé.");
