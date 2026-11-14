
document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.berSupabase;
  const productsContainer = document.getElementById("marketProducts");
  const shopsContainer = document.getElementById("marketShops");
  const searchForm = document.getElementById("marketSearchForm");
  const searchInput = document.getElementById("marketSearch");
  const categoryButtons = document.querySelectorAll("[data-category]");

  if (!productsContainer || !shopsContainer) return;

  if (!supabase) {
    productsContainer.textContent =
      "Connexion à la base de données indisponible.";
    return;
  }

  let products = [];
  let selectedCategory = "all";
  let searchTerm = "";

  function safeText(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);
  }

  function displayProducts() {
    const filtered = products.filter(product => {
      const matchesSearch =
        (product.name || "").toLowerCase().includes(searchTerm) ||
        (product.description || "").toLowerCase().includes(searchTerm);

      const matchesCategory =
        selectedCategory === "all" ||
        (product.category || "").toLowerCase() === selectedCategory;

      return matchesSearch && matchesCategory;
    });

    if (!filtered.length) {
      productsContainer.textContent =
        "Aucun produit disponible pour cette recherche.";
      return;
    }

    productsContainer.innerHTML = filtered.map(product => `
      <article class="market-product">
        <h3>${safeText(product.name)}</h3>
    ${(product.image_paths || []).map(path => {
  const { data } = supabase.storage
    .from("product-images")
    .getPublicUrl(path);

  return `<img src="${safeText(data.publicUrl)}"
    alt="${safeText(product.name)}"
    style="width:100%;max-width:220px;height:160px;object-fit:cover;border-radius:10px;">`;
}).join("")}
        <p>${safeText(product.description || "Aucune description")}</p>
        <span class="market-product-category">
  ${safeText(product.category || "Autre")}
</span>

<strong>
  ${safeText(product.price)} ${safeText(product.currency || "XOF")}
</strong>
      </article>
    `).join("");
  }

  async function loadProducts() {
    productsContainer.textContent = "Chargement des produits...";

    const { data, error } = await supabase
      .from("products")
      .select("id, name, description, price, currency, status, category, image_paths")
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erreur catalogue :", error);
      productsContainer.textContent =
        "Impossible de charger les produits pour le moment.";
      return;
    }

    products = data || [];
    displayProducts();
  }

  
async function loadShops() {
  shopsContainer.textContent = "Chargement des boutiques...";

  const [individualResult, companyResult] = await Promise.all([
    supabase
      .from("ber_shops")
      .select("id, name, description, category")
      .eq("is_active", true)
      .order("created_at", { ascending: false }),

    supabase
      .from("stores")
      .select("id, name, description, city, country")
      .eq("status", "active")
      .order("created_at", { ascending: false })
  ]);

  if (individualResult.error) {
    console.error("Erreur boutiques individuelles:", individualResult.error);
  }

  if (companyResult.error) {
    console.error("Erreur boutiques entreprises:", companyResult.error);
  }

  if (individualResult.error && companyResult.error) {
    shopsContainer.textContent =
      "Impossible de charger les boutiques.";
    return;
  }

  const individualShops = (individualResult.data || []).map(shop => ({
    ...shop,
    shopType: "Vendeur individuel"
  }));

  const companyShops = (companyResult.data || []).map(shop => ({
    ...shop,
    shopType: "Entreprise"
  }));

  const allShops = [...individualShops, ...companyShops];

  if (!allShops.length) {
    shopsContainer.textContent =
      "Aucune boutique active pour le moment.";
    return;
  }

  shopsContainer.innerHTML = allShops.map(shop => `
    <article class="market-shop">
      <h3>${safeText(shop.name)}</h3>
      <p>${safeText(shop.description || "Boutique B.E.R.")}</p>
      <span>${safeText(shop.shopType)}</span>
      ${shop.city ? `<p>${safeText(shop.city)}</p>` : ""}
    </article>
  `).join("");
}


  if (searchForm) {
    searchForm.addEventListener("submit", event => {
      event.preventDefault();
      searchTerm = (searchInput.value || "").trim().toLowerCase();
      displayProducts();
    });
  }

  categoryButtons.forEach(button => {
    button.addEventListener("click", () => {
      categoryButtons.forEach(item =>
        item.classList.remove("active")
      );

      button.classList.add("active");
      selectedCategory = button.dataset.category;
      displayProducts();
    });
  });

  await Promise.all([loadProducts(), loadShops()]);
});


