
document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.berSupabase;
  const form = document.getElementById("addProductForm");
  const message = document.getElementById("productFormMessage");
  const productsContainer = document.getElementById("salesProducts");
  const imagesInput = document.getElementById("productImages");

  if (!form || !message || !productsContainer || !imagesInput) return;

  let currentShop = null;

  function showMessage(text, success = false) {
  message.textContent = text;
  message.style.display = "block";
  message.style.color = success ? "#166534" : "#991b1b";
  message.style.background = success ? "#dcfce7" : "#fee2e2";
  message.style.border = success
    ? "1px solid #86efac"
    : "1px solid #fca5a5";
}

  function safeText(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);
  }

  function statusLabel(status) {
    const labels = {
      pending: "En attente de validation",
      active: "Validé et publié",
      rejected: "Refusé"
    };

    return labels[status] || "Statut inconnu";
  }

  async function loadProducts() {
    productsContainer.textContent = "Chargement des produits...";

    const { data, error } = await supabase
      .from("products")
      .select("id, name, description, price, currency, stock, status, category, image_paths")
      .eq("ber_shop_id", currentShop.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erreur chargement :", error);
      productsContainer.textContent = "Impossible de charger tes produits.";
      return;
    }

    if (!data || data.length === 0) {
      productsContainer.textContent = "Tu n'as pas encore de produit enregistré.";
      return;
    }

    productsContainer.innerHTML = data.map(product => `
      <article class="market-product sales-product-card">
        <h3>${safeText(product.name)}</h3>

        ${(product.image_paths || []).map(path => {
          const { data } = supabase.storage
            .from("product-images")
            .getPublicUrl(path);

          return `
            <img
              src="${safeText(data.publicUrl)}"
              alt="${safeText(product.name)}"
              style="width:100%;max-width:220px;height:160px;object-fit:cover;border-radius:10px;margin:5px;"
            >
          `;
        }).join("")}

        <p>${safeText(product.description || "Aucune description")}</p>
        <p>Catégorie : ${safeText(product.category || "Autre")}</p>

        <strong>
          ${safeText(product.price)}
          ${safeText(product.currency || "XOF")}
        </strong>

        <p>Stock : ${safeText(product.stock)}</p>
        <p><strong>${safeText(statusLabel(product.status))}</strong></p>

        <button
          type="button"
          class="delete-product-btn"
          data-product-id="${safeText(product.id)}"
        >
          Supprimer ce produit
        </button>
      </article>
    `).join("");

    productsContainer.querySelectorAll(".delete-product-btn")
      .forEach(button => {
        button.addEventListener("click", async () => {
          const productId = button.dataset.productId;

          if (!confirm("Supprimer ce produit et ses photos ?")) return;

          button.disabled = true;

          const { data: product, error: readError } = await supabase
            .from("products")
            .select("image_paths")
            .eq("id", productId)
            .eq("ber_shop_id", currentShop.id)
            .maybeSingle();

          if (readError || !product) {
            alert("Impossible de retrouver ce produit.");
            button.disabled = false;
            return;
          }

          const { error } = await supabase
            .from("products")
            .delete()
            .eq("id", productId)
            .eq("ber_shop_id", currentShop.id);

          if (error) {
            alert("Impossible de supprimer le produit.");
            button.disabled = false;
            return;
          }

          if (product.image_paths?.length) {
            const { error: imageError } = await supabase.storage
              .from("product-images")
              .remove(product.image_paths);

            if (imageError) {
              console.error("Nettoyage des photos impossible :", imageError);
            }
          }

          alert("Produit supprimé.");
          await loadProducts();
        });
      });
  }

  async function initializeSeller() {
    if (!supabase) {
      productsContainer.textContent = "Connexion à Supabase indisponible.";
      return;
    }

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser();

    if (authError || !user) {
      productsContainer.textContent = "Connecte-toi pour consulter tes produits.";
      return;
    }

    const { data: shop, error: shopError } = await supabase
      .from("ber_shops")
      .select("id, is_active")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (shopError || !shop || !shop.is_active) {
      productsContainer.textContent = "Aucune boutique individuelle active trouvée.";
      return;
    }

    currentShop = shop;
    await loadProducts();
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();

    if (!supabase || !currentShop) {
      showMessage("Ta boutique n'est pas disponible.");
      return;
    }

    const button = form.querySelector('button[type="submit"]');
const originalButtonText = button.textContent;

button.disabled = true;
button.textContent = "Envoi en cours...";
button.style.opacity = "0.7";

    const uploadedImagePaths = [];
    let productSaved = false;

    try {
      showMessage("Vérification du vendeur...");

      const {
        data: { user },
        error: authError
      } = await supabase.auth.getUser();

      if (authError || !user) {
        showMessage("Connecte-toi avant d'ajouter un produit.");
        return;
      }

      const { data: verification, error: verificationError } =
        await supabase
          .from("ber_seller_verifications")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle();

      if (verificationError) throw verificationError;

      if (!verification) {
        showMessage("Ton compte vendeur doit être vérifié.");
        return;
      }

      const name = document.getElementById("productName").value.trim();
      const category = document.getElementById("productCategory").value;
      const description = document.getElementById("productDescription").value.trim();
      const price = Number(document.getElementById("productPrice").value);
      const stock = Number(document.getElementById("productStock").value);

      if (
        !name ||
        !category ||
        !Number.isSafeInteger(price) ||
        price < 0 ||
        !Number.isSafeInteger(stock) ||
        stock < 0
      ) {
        showMessage("Vérifie les informations du produit.");
        return;
      }

      const selectedFiles = Array.from(imagesInput.files || []);

      if (selectedFiles.length > 5) {
        showMessage("Tu peux ajouter 5 photos maximum.");
        return;
      }

      for (const file of selectedFiles) {
        if (!file.type.startsWith("image/")) {
          showMessage("Un fichier sélectionné n'est pas une image.");
          return;
        }

        if (file.size > 5 * 1024 * 1024) {
          showMessage("Chaque image doit faire 5 Mo maximum.");
          return;
        }
      }

      
const progressBox = document.getElementById("uploadProgress");
const progressBar = document.getElementById("uploadProgressBar");
const progressText = document.getElementById("uploadProgressText");

if (selectedFiles.length > 0) {
  progressBox.style.display = "block";
  progressBar.style.width = "0%";
  progressText.textContent = "Préparation des photos...";
}

try {
  for (let i = 0; i < selectedFiles.length; i++) {
    const file = selectedFiles[i];

    const extension = file.name.includes(".")
      ? file.name.split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "")
      : "jpg";

    const path = `${user.id}/${Date.now()}_${i}.${extension || "jpg"}`;

    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(path, file, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) throw uploadError;

    uploadedImagePaths.push(path);

    const percent = Math.round(
      ((i + 1) / selectedFiles.length) * 100
    );

    progressBar.style.width = percent + "%";
    progressText.textContent =
      `Envoi des photos : ${percent}%`;
  }
} finally {
  progressBox.style.display = "none";
}

       

      showMessage("Enregistrement du produit...");

      const { error: insertError } = await supabase
        .from("products")
        .insert({
          store_id: null,
          ber_shop_id: currentShop.id,
          name,
          category,
          description: description || null,
          price,
          currency: "XOF",
          stock,
          image_paths: uploadedImagePaths,
          status: "pending"
        });

      if (insertError) throw insertError;

      productSaved = true;
form.reset();

showMessage("✅ Produit enregistré avec succès ! Il est maintenant en attente de validation.", true);

alert("Ton produit a bien été enregistré !");

await loadProducts();

    } catch (error) {
      console.error("Erreur ajout produit :", error);

      showMessage(
        "Impossible d'enregistrer le produit. Vérifie les autorisations."
      );

      if (!productSaved && uploadedImagePaths.length > 0) {
        const { error: cleanupError } = await supabase.storage
          .from("product-images")
          .remove(uploadedImagePaths);

        if (cleanupError) {
          console.error("Erreur nettoyage des images :", cleanupError);
        }
      }
} finally {
  button.disabled = false;
  button.textContent = originalButtonText;
  button.style.opacity = "1";
}
  });

  await initializeSeller();
});
