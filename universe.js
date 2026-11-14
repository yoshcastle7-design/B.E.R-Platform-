
/* B.E.R. PLATFORM - UNIVERSAL ENGINE */

const pageData = {
  business: {
    title: "B.E.R. Business",
    subtitle: "Entreprendre, innover et grandir.",
    description: "Développez vos idées, vos entreprises et vos opportunités.",
    gif: "../assets/gifs/ber-business.gif",
    image: "../assets/images/ber-business.png",
    features: [
      ["🛍️", "Marketplace", "Produits, boutiques et commandes."],
      ["📊", "Marketing", "Stratégie, communication et croissance."],
      ["📁", "Gestion de projets", "Planification et suivi des activités."],
      ["🤝", "Crowdfunding", "Financement participatif par dons et récompenses."]
    ]
  },
  education: {
    title: "B.E.R. Éducation",
    subtitle: "Apprendre, progresser et réussir.",
    description: "Développez vos connaissances grâce à des formations et des outils interactifs.",
    gif: "../assets/gifs/ber-education.gif",
    image: "../assets/images/ber-education.png",
    features: [
      ["📚", "Cours et formations", "Des parcours pour développer vos compétences."],
      ["🧠", "Quiz", "Des exercices et évaluations interactives."],
      ["📖", "Bibliothèque", "Des ressources et documents pédagogiques."],
      ["🤖", "B.E.R. AI", "Un assistant pour accompagner l'apprentissage."]
    ]
  },
  relations: {
    title: "B.E.R. Relations",
    subtitle: "Connecter, collaborer et grandir.",
    description: "Un espace dédié à l'emploi, au recrutement et aux relations professionnelles.",
    gif: "../assets/gifs/ber-relations.gif",
    image: "../assets/images/ber-relations-illustration.png",
    features: [
      ["💼", "Offres d'emploi", "Découvrez les opportunités professionnelles."],
      ["👥", "Recrutement", "Mettez en relation candidats et recruteurs."],
      ["🌐", "Réseau professionnel", "Développez vos relations professionnelles."],
      ["🎤", "Événements", "Conférences, rencontres et ateliers."]
    ]
  }
};

const currentPage = document.body.dataset.universe;
const data = pageData[currentPage];

if (data) {
  const root = document.getElementById("universeApp");

  root.innerHTML = `
    <header class="universe-header">
      <a class="universe-logo" href="../index.html">B.E.R. Platform</a>
      <nav>
        <a href="../index.html">Accueil</a>
        <a href="business.html">Business</a>
        <a href="education.html">Éducation</a>
        <a href="relations.html">Relations</a>
      </nav>
      <button class="universe-btn" id="universeTheme">🌙</button>
    </header>

    <section class="universe-hero universe-reveal">
      <div>
        <p>B.E.R. PLATFORM • ${currentPage.toUpperCase()}</p>
        <h1>${data.title}</h1>
        <h2>${data.subtitle}</h2>
        <p>${data.description}</p>
        <button class="universe-btn" id="exploreFeatures">
          Explorer les fonctionnalités ↓
        </button>
      </div>
      <img src="${data.gif}" alt="${data.title}" class="universe-animation">
    </section>

    <main class="universe-container" id="features">
      <h2>Explorez notre univers</h2>
      <div class="universe-grid">
        ${data.features.map((feature, index) => `
          <article class="universe-feature universe-reveal">
            <div class="universe-icon">${feature[0]}</div>
            <h3>${feature[1]}</h3>
            <p>${feature[2]}</p>
            <button class="universe-btn feature-action"
              data-feature="${index}">
              Découvrir →
            </button>
          </article>
        `).join("")}
      </div>
      <div id="featureDetails" aria-live="polite"></div>
    </main>

    <footer class="universe-footer">
      © 2026 B.E.R. Platform — Tous droits réservés.
    </footer>
  `;

  document.getElementById("exploreFeatures").onclick = () => {
    document.getElementById("features").scrollIntoView({
      behavior: "smooth"
    });
  };

  document.querySelectorAll(".feature-action").forEach(button => {
    button.onclick = () => {
      const feature = data.features[Number(button.dataset.feature)];
      document.getElementById("featureDetails").innerHTML = `
        <section class="universe-feature universe-reveal">
          <h2>${feature[0]} ${feature[1]}</h2>
          <p>${feature[2]}</p>
          <p>Cette fonctionnalité sera activée dans une prochaine étape.</p>
        </section>
      `;
      document.getElementById("featureDetails").scrollIntoView({
        behavior: "smooth"
      });
    };
  });

  const themeButton = document.getElementById("universeTheme");

  function applyTheme(theme) {
    document.querySelector(".universe-page").classList.toggle(
      "dark", theme === "dark"
    );
    themeButton.textContent = theme === "dark" ? "☀️" : "🌙";
    localStorage.setItem("ber-theme", theme);
  }

  applyTheme(localStorage.getItem("ber-theme") || "light");

  themeButton.onclick = () => {
    const dark = document.querySelector(".universe-page")
      .classList.contains("dark");
    applyTheme(dark ? "light" : "dark");
  };
}


