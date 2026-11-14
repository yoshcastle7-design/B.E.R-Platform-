
/* =====================================
   B.E.R. PLATFORM — DASHBOARD
   Version 0.0.0.1
   Authentification + Messagerie privée
===================================== */

(() => {
  "use strict";

  // 1. Éléments du Dashboard
  const message = document.getElementById("dashboardMessage");
  const emailElement = document.getElementById("userEmail");
  const logoutButton = document.getElementById("logoutButton");

  // 2. Éléments de la messagerie
  const memberSelect = document.getElementById("memberSelect");
  const openConversationButton =
    document.getElementById("openConversationButton");
  const conversationMessages =
    document.getElementById("conversationMessages");
  const messageInput = document.getElementById("messageInput");
  const sendMessageButton =
    document.getElementById("sendMessageButton");
  const messageStatus = document.getElementById("messageStatus");

  // 2b. Éléments du profil professionnel
  const proForm = document.getElementById("proProfileForm");
  const proDisplayName = document.getElementById("proDisplayName");
  const proAccountType = document.getElementById("proAccountType");
  const proHeadline = document.getElementById("proHeadline");
  const proCity = document.getElementById("proCity");
  const proBio = document.getElementById("proBio");
  const proSkills = document.getElementById("proSkills");
  const proAvailability = document.getElementById("proAvailability");
  const proOrganization = document.getElementById("proOrganization");
  const proAvailabilityField =
    document.getElementById("proAvailabilityField");
  const proOrganizationField =
    document.getElementById("proOrganizationField");
  const proSaveButton = document.getElementById("proProfileSave");
  const proStatus = document.getElementById("proProfileStatus");
  const proAvatar = document.getElementById("proAvatar");
const proAvatarPreview = document.getElementById("proAvatarPreview");
  if (proAvatar && proAvatarPreview) {
  proAvatar.addEventListener("change", () => {
    const fichier = proAvatar.files[0];

    if (!fichier) {
      proAvatarPreview.src = "";
      proAvatarPreview.hidden = true;
      return;
    }

    if (!fichier.type.startsWith("image/")) {
      proAvatar.value = "";
      proAvatarPreview.hidden = true;
      alert("Veuillez sélectionner une image.");
      return;
    }

    proAvatarPreview.src = URL.createObjectURL(fichier);
    proAvatarPreview.hidden = false;
  });
}

  // 2b-bis. Éléments du profil vendeur et de la boutique
  const sellerForm = document.getElementById("sellerForm");
  const sellerVerification =
    document.getElementById("sellerVerification");
  const sellerType = document.getElementById("sellerType");
  const sellerName = document.getElementById("sellerName");
  const sellerCity = document.getElementById("sellerCity");
  const sellerAvatar = document.getElementById("sellerAvatar");
const sellerAvatarPreview = document.getElementById("sellerAvatarPreview");
  if (sellerAvatar && sellerAvatarPreview) {
  sellerAvatar.addEventListener("change", () => {
    const fichier = sellerAvatar.files[0];

    if (!fichier) {
      sellerAvatarPreview.src = "";
      sellerAvatarPreview.hidden = true;
      return;
    }

    if (!fichier.type.startsWith("image/")) {
      sellerAvatar.value = "";
      sellerAvatarPreview.hidden = true;
      alert("Veuillez sélectionner une image.");
      return;
    }

    sellerAvatarPreview.src = URL.createObjectURL(fichier);
    sellerAvatarPreview.hidden = false;
  });
}
  const sellerSave = document.getElementById("sellerSave");
  const sellerStatus = document.getElementById("sellerStatus");
  const shopSection = document.getElementById("shopSection");
  const shopForm = document.getElementById("shopForm");
  const shopName = document.getElementById("shopName");
  const shopCategory = document.getElementById("shopCategory");
  const shopDescription = document.getElementById("shopDescription");
  const shopActive = document.getElementById("shopActive");
  const shopSave = document.getElementById("shopSave");
  const shopStatus = document.getElementById("shopStatus");

  // 2c. Onglets du Dashboard (Mon espace / Messages / Paramètres)
  (function initialiserOnglets() {
    const panneaux = Array.from(
      document.querySelectorAll("[data-panel]")
    );
    const onglets = Array.from(
      document.querySelectorAll("[data-tab]")
    );
    const barre = document.getElementById("dashboardTabs");

    if (panneaux.length === 0) return;

    const valides = panneaux.map((panneau) => panneau.dataset.panel);

    function ouvrirOnglet(defiler) {
      let cible = window.location.hash.replace("#", "") || "accueil";
      let ancre = null;

      // Ancien lien « Mon profil » : le profil est dans Paramètres
      if (cible === "profil") {
        ancre = "profil";
        cible = "parametres";
      }

      if (!valides.includes(cible)) {
        cible = "accueil";
      }

      panneaux.forEach((panneau) => {
        panneau.hidden = panneau.dataset.panel !== cible;
      });

      onglets.forEach((onglet) => {
        const actif = onglet.dataset.tab === cible;
        onglet.classList.toggle("active", actif);

        if (actif) {
          onglet.setAttribute("aria-current", "page");
        } else {
          onglet.removeAttribute("aria-current");
        }
      });

      if (cible === "messages" && conversationMessages) {
        conversationMessages.scrollTop =
          conversationMessages.scrollHeight;
      }

      const destination =
        (ancre && document.getElementById(ancre)) || barre;

      if ((defiler || ancre) && destination) {
        destination.scrollIntoView({ behavior: "smooth" });
      }
    }

    window.addEventListener("hashchange", () => ouvrirOnglet(true));
    ouvrirOnglet(false);
  })();

  if (!message || !emailElement || !logoutButton) {
    console.error("B.E.R. : éléments du Dashboard introuvables.");
    return;
  }

  if (!window.berAuth || !window.berSupabase) {
    message.textContent = "Service d'authentification indisponible.";
    logoutButton.disabled = true;
    return;
  }

  const client = window.berSupabase;

  let utilisateurId = null;
  let conversationActive = null;
  let deconnexionEnCours = false;
  let canalMessages = null;
  let profilEnCours = false;
  let vendeurEnCours = false;
  let boutiqueEnCours = false;

  function statutMessagerie(texte) {
    if (messageStatus) {
      messageStatus.textContent = texte;
    }
  }

  // 3. Création du profil dans l'annuaire
  async function verifierProfil(utilisateur) {
    const { data, error } = await client
      .from("ber_profiles")
      .select("user_id")
      .eq("user_id", utilisateur.id)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      const nom =
        utilisateur.user_metadata?.full_name ||
        utilisateur.user_metadata?.name ||
        "Membre B.E.R.";

      const resultat = await client
        .from("ber_profiles")
        .insert({
          user_id: utilisateur.id,
          display_name: nom
        });

      if (resultat.error) throw resultat.error;
    }
  }

  // 4. Chargement des membres
  async function chargerMembres() {
    if (!memberSelect) return;

    memberSelect.innerHTML = "";

    const optionInitiale = document.createElement("option");
    optionInitiale.value = "";
    optionInitiale.textContent = "Choisir un membre";
    memberSelect.appendChild(optionInitiale);

    const { data, error } = await client
      .from("ber_profiles")
      .select("user_id, display_name")
      .neq("user_id", utilisateurId)
      .order("display_name");

    if (error) {
      statutMessagerie("Impossible de charger les membres.");
      console.error("B.E.R. Annuaire :", error);
      return;
    }

    if (!data || data.length === 0) {
      statutMessagerie("Aucun autre membre inscrit pour le moment.");
      return;
    }

    data.forEach((membre) => {
      const option = document.createElement("option");
      option.value = membre.user_id;
      option.textContent = membre.display_name;
      memberSelect.appendChild(option);
    });

    statutMessagerie("Annuaire des membres chargé.");
  }

  // 5. Affichage sécurisé des messages
  function afficherMessages(messages) {
    if (!conversationMessages) return;

    conversationMessages.textContent = "";

    if (!messages || messages.length === 0) {
      conversationMessages.textContent =
        "Aucun message dans cette conversation.";
      return;
    }

    messages.forEach((item) => {
      const bloc = document.createElement("div");
      bloc.className =
        item.sender_id === utilisateurId
          ? "ber-message ber-message-own"
          : "ber-message ber-message-other";

      const auteur = document.createElement("strong");
      auteur.textContent =
        item.sender_id === utilisateurId
          ? "Vous"
          : conversationActive?.nom || "Membre";

      const contenu = document.createElement("p");
      contenu.textContent = item.content;

      const date = document.createElement("small");
      date.textContent = new Date(item.created_at).toLocaleString("fr-FR");

      bloc.appendChild(auteur);
      bloc.appendChild(contenu);
      bloc.appendChild(date);

      conversationMessages.appendChild(bloc);
    });

    conversationMessages.scrollTop =
      conversationMessages.scrollHeight;
  }

  // 6. Chargement d'une conversation
  async function chargerConversation() {
    if (!conversationActive) return;

    statutMessagerie("Chargement des messages...");

    const autreId = conversationActive.id;

    const filtre =
      "and(sender_id.eq." + utilisateurId +
      ",recipient_id.eq." + autreId + ")" +
      ",and(sender_id.eq." + autreId +
      ",recipient_id.eq." + utilisateurId + ")";

    const { data, error } = await client
      .from("ber_messages")
      .select("id, sender_id, recipient_id, content, created_at")
      .or(filtre)
      .order("created_at", { ascending: true })
      .limit(100);

    if (error) {
      statutMessagerie("Erreur de chargement des messages.");
      console.error("B.E.R. Messages :", error);
      return;
    }

    afficherMessages(data);
    statutMessagerie("Conversation ouverte.");
  }

  // 7. Ouverture d'une conversation
  if (openConversationButton && memberSelect) {
    openConversationButton.addEventListener("click", async () => {
      const autreId = memberSelect.value;

      if (!autreId) {
        statutMessagerie("Choisissez d'abord un membre.");
        return;
      }

      const nom =
        memberSelect.options[memberSelect.selectedIndex].textContent;

      conversationActive = {
        id: autreId,
        nom: nom
      };

      await chargerConversation();
    });
  }

  // 8. Envoi d'un message
  if (sendMessageButton && messageInput) {
    sendMessageButton.addEventListener("click", async () => {
      if (!conversationActive) {
        statutMessagerie("Ouvrez d'abord une conversation.");
        return;
      }

      const contenu = messageInput.value.trim();

      if (!contenu) {
        statutMessagerie("Écrivez un message avant l'envoi.");
        return;
      }

      sendMessageButton.disabled = true;
      statutMessagerie("Envoi du message...");

      try {
        const { error } = await client
          .from("ber_messages")
          .insert({
            sender_id: utilisateurId,
            recipient_id: conversationActive.id,
            content: contenu
          });

        if (error) throw error;

        messageInput.value = "";
        await chargerConversation();
        statutMessagerie("Message envoyé.");

      } catch (error) {
        console.error("B.E.R. Envoi :", error);
        statutMessagerie("Échec de l'envoi : " + error.message);

      } finally {
        sendMessageButton.disabled = false;
      }
    });
  }

  // 9. Réception en temps réel
  function activerTempsReel() {
    if (canalMessages) return;

    canalMessages = client
      .channel("ber-messages-" + utilisateurId)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ber_messages"
        },
        (payload) => {
          const nouveau = payload.new;

          if (
            conversationActive &&
            (
              (nouveau.sender_id === utilisateurId &&
               nouveau.recipient_id === conversationActive.id) ||
              (nouveau.sender_id === conversationActive.id &&
               nouveau.recipient_id === utilisateurId)
            )
          ) {
            chargerConversation();
          }
        }
      )
      .subscribe();
  }

  // 10. Profil professionnel
  function statutProfil(texte) {
    if (proStatus) {
      proStatus.textContent = texte;
    }
  }

  function adapterChampsProfil() {
    if (!proAccountType) return;

    const recruteur = proAccountType.value === "recruteur";

    if (proAvailabilityField) {
      proAvailabilityField.hidden = recruteur;
    }

    if (proOrganizationField) {
      proOrganizationField.hidden = !recruteur;
    }
  }

  function valeurOuNull(champ) {
    const valeur = champ.value.trim();
    return valeur === "" ? null : valeur;
  }

  async function chargerProfilPro() {
    if (!proForm) return;

    try {
      statutProfil("Chargement de votre profil...");

      const [base, pro] = await Promise.all([
        client
          .from("ber_profiles")
          .select("display_name")
          .eq("user_id", utilisateurId)
          .maybeSingle(),
        client
          .from("ber_pro_profiles")
          .select(
  "account_type, headline, city, bio, skills, " +
  "availability, organization, avatar_path"
)
          .eq("user_id", utilisateurId)
          .maybeSingle()
      ]);

      if (base.error) throw base.error;
      if (pro.error) throw pro.error;

      proDisplayName.value = base.data?.display_name || "";

      if (pro.data) {
        proAccountType.value = pro.data.account_type || "candidat";
        proHeadline.value = pro.data.headline || "";
        proCity.value = pro.data.city || "";
        proBio.value = pro.data.bio || "";
        proSkills.value = pro.data.skills || "";
        proAvailability.value = pro.data.availability || "";
       proOrganization.value = pro.data.organization || "";

if (pro.data.avatar_path && proAvatarPreview) {
  const { data } = client.storage
    .from("profile-images")
    .getPublicUrl(pro.data.avatar_path);

  proAvatarPreview.src = data.publicUrl;
  proAvatarPreview.hidden = false;
}

statutProfil("");
      } else {
        
        statutProfil(
          "Votre profil professionnel n'est pas encore renseigné."
        );
      }

      adapterChampsProfil();

    } catch (error) {
      console.error("B.E.R. Profil :", error);
      statutProfil("Impossible de charger votre profil.");
    }
  }

  async function enregistrerProfilPro(event) {
  event.preventDefault();

  if (profilEnCours) return;

  const nom = proDisplayName.value.trim();
  const fichierAvatar = proAvatar?.files?.[0];

  if (nom.length < 2) {
    statutProfil("Le nom affiché doit contenir au moins 2 caractères.");
    proDisplayName.focus();
    return;
  }

  const formatsAutorises = [
    "image/jpeg",
    "image/png",
    "image/webp"
  ];

  if (fichierAvatar) {
    if (!formatsAutorises.includes(fichierAvatar.type)) {
      statutProfil("Format accepté : JPG, PNG ou WebP.");
      return;
    }

    if (fichierAvatar.size > 2 * 1024 * 1024) {
      statutProfil("La photo ne doit pas dépasser 2 Mo.");
      return;
    }
  }

  let nouveauAvatarPath = null;

  profilEnCours = true;
  proSaveButton.disabled = true;
  statutProfil("Enregistrement du profil...");

  try {
    // Récupérer l'ancienne photo pour la conserver si nécessaire
    const ancienProfil = await client
      .from("ber_pro_profiles")
      .select("avatar_path")
      .eq("user_id", utilisateurId)
      .maybeSingle();

    if (ancienProfil.error) throw ancienProfil.error;

    let avatarPath = ancienProfil.data?.avatar_path || null;

    // Envoyer la nouvelle photo
    if (fichierAvatar) {
      const extension = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp"
      }[fichierAvatar.type];

      nouveauAvatarPath =
        utilisateurId + "/" + Date.now() + "." + extension;

      const { error: uploadError } = await client.storage
        .from("profile-images")
        .upload(nouveauAvatarPath, fichierAvatar, {
          cacheControl: "3600",
          upsert: false,
          contentType: fichierAvatar.type
        });

      if (uploadError) throw uploadError;

      avatarPath = nouveauAvatarPath;
    }

    const recruteur = proAccountType.value === "recruteur";

    const profil = {
      user_id: utilisateurId,
      account_type: proAccountType.value,
      headline: valeurOuNull(proHeadline),
      city: valeurOuNull(proCity),
      bio: valeurOuNull(proBio),
      skills: valeurOuNull(proSkills),
      availability: recruteur ? null : valeurOuNull(proAvailability),
      organization: recruteur ? valeurOuNull(proOrganization) : null,
      avatar_path: avatarPath
    };

    const maj = await client
      .from("ber_profiles")
      .update({ display_name: nom })
      .eq("user_id", utilisateurId);

    if (maj.error) throw maj.error;

    const resultat = await client
      .from("ber_pro_profiles")
      .upsert(profil, { onConflict: "user_id" });

    if (resultat.error) throw resultat.error;

    // Afficher la photo enregistrée
    if (avatarPath && proAvatarPreview) {
      const { data } = client.storage
        .from("profile-images")
        .getPublicUrl(avatarPath);

      proAvatarPreview.src = data.publicUrl;
      proAvatarPreview.hidden = false;
    }

    statutProfil("Profil professionnel enregistré.");

  } catch (error) {
    console.error("B.E.R. Profil :", error);
    statutProfil("Échec de l'enregistrement : " + error.message);

    // Nettoyer uniquement la nouvelle photo en cas d'échec
    if (nouveauAvatarPath) {
      await client.storage
        .from("profile-images")
        .remove([nouveauAvatarPath]);
    }

  } finally {
    profilEnCours = false;
    proSaveButton.disabled = false;
  }
}

  if (proForm) {
    proForm.addEventListener("submit", enregistrerProfilPro);
  }

  if (proAccountType) {
    proAccountType.addEventListener("change", adapterChampsProfil);
  }

  // 11. Profil vendeur et boutique (Marketplace)
  function statutVendeur(texte) {
    if (sellerStatus) {
      sellerStatus.textContent = texte;
    }
  }

  function statutBoutique(texte) {
    if (shopStatus) {
      shopStatus.textContent = texte;
    }
  }

  function afficherVerification(verifie) {
    if (sellerVerification) {
      sellerVerification.dataset.verified = verifie ? "true" : "false";
      sellerVerification.textContent = verifie
        ? "✅ Vendeur vérifié"
        : "Non vérifié";
    }

    // Un vendeur vérifié ne peut plus changer son nom ni son type
    if (sellerType) sellerType.disabled = verifie;
    if (sellerName) sellerName.disabled = verifie;
  }

  function afficherSectionBoutique(visible) {
    if (shopSection) {
      shopSection.hidden = !visible;
    }
  }

  async function chargerVendeur() {
    if (!sellerForm) return;

    try {
      statutVendeur("Chargement de votre profil vendeur...");

      const [vendeur, verification, boutique] = await Promise.all([
        client
          .from("ber_seller_profiles")
         .select("seller_type, seller_name, city, avatar_path")
          .eq("user_id", utilisateurId)
          .maybeSingle(),
        client
          .from("ber_seller_verifications")
          .select("user_id")
          .eq("user_id", utilisateurId)
          .maybeSingle(),
        client
          .from("ber_shops")
          .select("name, description, category, is_active")
          .eq("owner_id", utilisateurId)
          .maybeSingle()
      ]);

      if (vendeur.error) throw vendeur.error;
      if (verification.error) throw verification.error;
      if (boutique.error) throw boutique.error;

      if (vendeur.data) {
        sellerType.value = vendeur.data.seller_type || "particulier";
        sellerName.value = vendeur.data.seller_name || "";
        sellerCity.value = vendeur.data.city || "";
        statutVendeur("");
        if (vendeur.data.avatar_path) {
  const { data } = client.storage
    .from("profile-images")
    .getPublicUrl(vendeur.data.avatar_path);

  sellerAvatarPreview.src = data.publicUrl;
  sellerAvatarPreview.hidden = false;
}
      } else {
        // Suggestion : reprendre le nom affiché du profil
        sellerName.value = proDisplayName ? proDisplayName.value : "";
        statutVendeur("Votre profil vendeur n'est pas encore créé.");
      }

      afficherVerification(Boolean(vendeur.data && verification.data));
      afficherSectionBoutique(Boolean(vendeur.data));

      if (boutique.data) {
        shopName.value = boutique.data.name || "";
        shopCategory.value = boutique.data.category || "";
        shopDescription.value = boutique.data.description || "";
        shopActive.value = boutique.data.is_active ? "true" : "false";
        statutBoutique("");
      } else {
        statutBoutique("Votre boutique n'est pas encore créée.");
      }

    } catch (error) {
      console.error("B.E.R. Vendeur :", error);
      statutVendeur("Impossible de charger votre profil vendeur.");
    }
  }

 async function enregistrerVendeur(event) {
  event.preventDefault();

  if (vendeurEnCours) return;

  const nom = sellerName.value.trim();
  const fichierAvatar = sellerAvatar?.files?.[0];

  if (nom.length < 2) {
    statutVendeur("Le nom doit contenir au moins 2 caractères.");
    sellerName.focus();
    return;
  }

  const formatsAutorises = [
    "image/jpeg",
    "image/png",
    "image/webp"
  ];

  if (fichierAvatar) {
    if (!formatsAutorises.includes(fichierAvatar.type)) {
      statutVendeur("Format accepté : JPG, PNG ou WebP.");
      return;
    }

    if (fichierAvatar.size > 2 * 1024 * 1024) {
      statutVendeur("La photo ne doit pas dépasser 2 Mo.");
      return;
    }
  }

  let avatarPath = null;

  if (fichierAvatar) {
    const extension = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp"
    }[fichierAvatar.type];

    avatarPath =
      utilisateurId + "/" + Date.now() + "." + extension;
  }

  vendeurEnCours = true;
  sellerSave.disabled = true;
  statutVendeur("Enregistrement...");

  try {
    if (fichierAvatar) {
      const { error: uploadError } = await client.storage
        .from("profile-images")
        .upload(avatarPath, fichierAvatar, {
          cacheControl: "3600",
          upsert: false,
          contentType: fichierAvatar.type
        });

      if (uploadError) throw uploadError;
    }

    const profil = {
      user_id: utilisateurId,
      seller_type: sellerType.value,
      seller_name: nom,
      city: valeurOuNull(sellerCity)
    };

    if (avatarPath) {
      profil.avatar_path = avatarPath;
    }

    const resultat = await client
      .from("ber_seller_profiles")
      .upsert(profil, { onConflict: "user_id" });

    if (resultat.error) throw resultat.error;

    if (avatarPath) {
      const { data } = client.storage
        .from("profile-images")
        .getPublicUrl(avatarPath);

      sellerAvatarPreview.src = data.publicUrl;
      sellerAvatarPreview.hidden = false;
    }

    statutVendeur("Profil vendeur enregistré.");
    afficherSectionBoutique(true);

  } catch (error) {
    console.error("B.E.R. Vendeur :", error);
    statutVendeur("Échec de l'enregistrement : " + error.message);

    if (avatarPath) {
      await client.storage
        .from("profile-images")
        .remove([avatarPath]);
    }

  } finally {
    vendeurEnCours = false;
    sellerSave.disabled = false;
  }
}

   

  async function enregistrerBoutique(event) {
    event.preventDefault();

    if (boutiqueEnCours) return;

    const nom = shopName.value.trim();

    if (nom.length < 2) {
      statutBoutique(
        "Le nom de la boutique doit contenir au moins 2 caractères."
      );
      shopName.focus();
      return;
    }

    const boutique = {
      owner_id: utilisateurId,
      name: nom,
      category: valeurOuNull(shopCategory),
      description: valeurOuNull(shopDescription),
      is_active: shopActive.value === "true"
    };

    boutiqueEnCours = true;
    shopSave.disabled = true;
    statutBoutique("Enregistrement...");

    try {
      const resultat = await client
        .from("ber_shops")
        .upsert(boutique, { onConflict: "owner_id" });

      if (resultat.error) throw resultat.error;

      statutBoutique("Boutique enregistrée.");

    } catch (error) {
      console.error("B.E.R. Boutique :", error);
      statutBoutique("Échec de l'enregistrement : " + error.message);

    } finally {
      boutiqueEnCours = false;
      shopSave.disabled = false;
    }
  }

  if (sellerForm) {
    sellerForm.addEventListener("submit", enregistrerVendeur);
  }

  if (shopForm) {
    shopForm.addEventListener("submit", enregistrerBoutique);
  }

  // 12. Initialisation du Dashboard
  async function initialiserDashboard() {
    try {
      message.textContent = "Vérification de votre session...";
      logoutButton.disabled = true;

      const { data, error } = await client.auth.getSession();

      if (error) throw error;

      const session = data.session;

      if (!session) {
        window.location.replace("./login.html");
        return;
      }

      const utilisateur = session.user;
      utilisateurId = utilisateur.id;

      const nom =
        utilisateur.user_metadata?.full_name ||
        utilisateur.user_metadata?.name ||
        utilisateur.email ||
        "Utilisateur B.E.R.";

      emailElement.textContent =
        "Bienvenue, " + nom +
        (utilisateur.email ? " — " + utilisateur.email : "");

      await verifierProfil(utilisateur);
      await chargerMembres();

      activerTempsReel();

      message.textContent = "Votre espace personnel est prêt.";
      logoutButton.disabled = false;

      await chargerProfilPro();
      await chargerVendeur();

    } catch (error) {
      console.error("B.E.R. Dashboard :", error);

      message.textContent =
        "Impossible d'initialiser votre espace. Vérifiez votre connexion.";

      statutMessagerie("Messagerie indisponible.");
      logoutButton.disabled = true;
    }
  }

  // 13. Déconnexion
  logoutButton.addEventListener("click", async () => {
    if (deconnexionEnCours) return;

    deconnexionEnCours = true;
    logoutButton.disabled = true;
    message.textContent = "Déconnexion en cours...";

    try {
      if (canalMessages) {
        await client.removeChannel(canalMessages);
        canalMessages = null;
      }

      const { error } = await window.berAuth.signOut();

      if (error) throw error;

      window.location.replace("./login.html");

    } catch (error) {
      console.error("B.E.R. Déconnexion :", error);

      message.textContent = "Erreur de déconnexion : " + error.message;

      logoutButton.disabled = false;
      deconnexionEnCours = false;
    }
  });

  // 14. Détection d'une déconnexion externe
  client.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT" && !deconnexionEnCours) {
      window.location.replace("./login.html");
    }
  });

  // 15. Lancement
  initialiserDashboard();

})();
