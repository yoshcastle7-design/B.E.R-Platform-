/* B.E.R. PLATFORM — module messagerie enrichie + avatars des contacts
   Dépend de window.berSupabase déjà initialisé dans supabase.js.
   Le module dashboard.js existant reste responsable des profils/boutique/auth.
*/
(() => {
  "use strict";

  const client = window.berSupabase;
  const memberSelect = document.getElementById("berChatMember");
  const openButton = document.getElementById("berOpenChat");
  const messagesBox = document.getElementById("berChatMessages");
  const input = document.getElementById("berChatInput");
  const fileInput = document.getElementById("berChatFile");
  const sendButton = document.getElementById("berSendChat");
  const status = document.getElementById("berChatStatus");
  const chatName = document.getElementById("berChatName");
  const chatHint = document.getElementById("berChatHint");
  const avatarBox = document.querySelector(".ber-chat-avatar");

  if (!client || !memberSelect || !messagesBox || !sendButton) return;

  const BUCKET = "ber-chat-files";
  const PROFILE_BUCKET = "profile-images";
  const MAX_BYTES = 15 * 1024 * 1024;
  const ALLOWED_TYPES = new Set([
    "image/jpeg", "image/png", "image/webp", "image/gif",
    "video/mp4", "video/webm",
    "audio/webm", "audio/ogg", "audio/mpeg", "audio/mp4", "audio/wav",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain", "text/csv", "application/zip", "application/x-zip-compressed"
  ]);

  let currentUserId = null;
  let activeMember = null;
  let channel = null;
  let loading = false;
  let lastLoadToken = 0;

  const setStatus = (text) => { if (status) status.textContent = text; };
  const formatDate = (value) => new Date(value).toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
  });

  function showEmpty(text) {
    messagesBox.replaceChildren();
    const p = document.createElement("p");
    p.className = "ber-chat-empty";
    p.textContent = text;
    messagesBox.appendChild(p);
  }

  function showFallbackAvatar(name) {
    if (!avatarBox) return;
    avatarBox.replaceChildren();
    avatarBox.textContent = (String(name || "B").trim().charAt(0) || "B").toUpperCase();
    avatarBox.setAttribute("aria-hidden", "true");
  }

  function showMemberAvatar(member) {
    if (!avatarBox) return;
    const name = member?.name || "Membre B.E.R.";
    if (!member?.avatarUrl) {
      showFallbackAvatar(name);
      return;
    }

    const img = document.createElement("img");
    img.src = member.avatarUrl;
    img.alt = "Photo de profil de " + name;
    img.loading = "lazy";
    img.decoding = "async";
    img.style.cssText = "display:block;width:100%;height:100%;object-fit:cover;border-radius:50%;";
    img.addEventListener("error", () => showFallbackAvatar(name), { once: true });
    avatarBox.removeAttribute("aria-hidden");
    avatarBox.replaceChildren(img);
  }

  function publicProfileUrl(path) {
    if (!path || typeof path !== "string") return null;
    const { data } = client.storage.from(PROFILE_BUCKET).getPublicUrl(path);
    return data?.publicUrl || null;
  }

  async function loadMembers() {
    memberSelect.replaceChildren();
    const first = document.createElement("option");
    first.value = "";
    first.textContent = "Choisir un membre";
    memberSelect.appendChild(first);

    const { data: profiles, error } = await client.from("ber_profiles")
      .select("user_id, display_name")
      .neq("user_id", currentUserId)
      .order("display_name", { ascending: true });

    if (error) throw error;

    const ids = (profiles || []).map(member => member.user_id).filter(Boolean);
    let professionalPhotos = [];
    let sellerPhotos = [];

    if (ids.length) {
      const [proResult, sellerResult] = await Promise.all([
        client.from("ber_pro_profiles").select("user_id, avatar_path").in("user_id", ids),
        client.from("ber_seller_profiles").select("user_id, avatar_path").in("user_id", ids)
      ]);
      if (proResult.error) console.warn("B.E.R. photos professionnelles:", proResult.error.message);
      if (sellerResult.error) console.warn("B.E.R. photos vendeurs:", sellerResult.error.message);
      professionalPhotos = proResult.data || [];
      sellerPhotos = sellerResult.data || [];
    }

    const proByUser = new Map(professionalPhotos.map(row => [row.user_id, row.avatar_path]));
    const sellerByUser = new Map(sellerPhotos.map(row => [row.user_id, row.avatar_path]));

    (profiles || []).forEach((profile) => {
      // Priorité à la photo professionnelle ; sinon, photo vendeur/logo.
      const avatarPath = proByUser.get(profile.user_id) || sellerByUser.get(profile.user_id) || null;
      const option = document.createElement("option");
      option.value = profile.user_id;
      option.textContent = profile.display_name || "Membre B.E.R.";
      option.dataset.avatarPath = avatarPath || "";
      memberSelect.appendChild(option);
    });

    if (!profiles?.length) setStatus("Aucun autre membre inscrit pour le moment.");
  }

  async function markIncomingAsRead(rows) {
    const incoming = (rows || []).filter(row => row.recipient_id === currentUserId);
    for (const row of incoming) {
      const { data, error } = await client.from("ber_message_receipts")
        .select("message_id, delivered_at, read_at")
        .eq("message_id", row.id)
        .eq("user_id", currentUserId)
        .maybeSingle();
      if (error) { console.warn("B.E.R. receipt read:", error.message); continue; }
      const now = new Date().toISOString();
      if (data) {
        if (!data.read_at) {
          const { error: updateError } = await client.from("ber_message_receipts")
            .update({ delivered_at: data.delivered_at || now, read_at: now })
            .eq("message_id", row.id)
            .eq("user_id", currentUserId);
          if (updateError) console.warn("B.E.R. receipt update:", updateError.message);
        }
      } else {
        const { error: insertError } = await client.from("ber_message_receipts")
          .insert({ message_id: row.id, user_id: currentUserId, delivered_at: now, read_at: now });
        if (insertError) console.warn("B.E.R. receipt insert:", insertError.message);
      }
    }
  }

  async function receiptMap(rows) {
    const own = (rows || []).filter(row => row.sender_id === currentUserId);
    const map = new Map();
    for (const row of own) {
      const { data, error } = await client.from("ber_message_receipts")
        .select("delivered_at, read_at")
        .eq("message_id", row.id)
        .maybeSingle();
      if (!error && data) map.set(row.id, data);
    }
    return map;
  }

  async function signedAttachment(path) {
    const { data, error } = await client.storage.from(BUCKET).createSignedUrl(path, 300);
    if (error) throw error;
    return data.signedUrl;
  }

  async function renderMessages(rows, token) {
    await markIncomingAsRead(rows);
    const receipts = await receiptMap(rows);
    if (token !== lastLoadToken) return;
    messagesBox.replaceChildren();

    if (!rows?.length) {
      showEmpty("Aucun message pour le moment. Envoyez le premier message.");
      return;
    }

    for (const row of rows) {
      const own = row.sender_id === currentUserId;
      const article = document.createElement("article");
      article.className = "ber-chat-message " + (own ? "own" : "other");

      if (row.content) {
        const p = document.createElement("p");
        p.textContent = row.content;
        article.appendChild(p);
      }

      if (row.attachment_path) {
        try {
          const url = await signedAttachment(row.attachment_path);
          if (token !== lastLoadToken) return;
          const mime = row.attachment_mime || "";
          if (mime.startsWith("image/")) {
            const img = document.createElement("img");
            img.className = "ber-chat-image";
            img.src = url;
            img.alt = row.attachment_name || "Image partagée";
            img.loading = "lazy";
            article.appendChild(img);
          }
          const link = document.createElement("a");
          link.className = "ber-chat-attachment";
          link.href = url;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = "📎 " + (row.attachment_name || "Fichier partagé");
          link.setAttribute("download", row.attachment_name || "fichier");
          article.appendChild(link);
        } catch (error) {
          const unavailable = document.createElement("small");
          unavailable.textContent = "Pièce jointe temporairement indisponible.";
          article.appendChild(unavailable);
          console.warn("B.E.R. pièce jointe:", error.message);
        }
      }

      const meta = document.createElement("div");
      meta.className = "ber-chat-meta";
      const date = document.createElement("span");
      date.textContent = formatDate(row.created_at);
      meta.appendChild(date);
      if (own) {
        const receipt = receipts.get(row.id);
        const mark = document.createElement("span");
        mark.textContent = receipt?.read_at ? "✓✓ Lu" : receipt?.delivered_at ? "✓✓ Reçu" : "✓ Envoyé";
        meta.appendChild(mark);
      }
      article.appendChild(meta);
      messagesBox.appendChild(article);
    }
    messagesBox.scrollTop = messagesBox.scrollHeight;
  }

  async function loadConversation() {
    if (!activeMember || loading) return;
    loading = true;
    const token = ++lastLoadToken;
    setStatus("Chargement de la conversation…");
    try {
      const otherId = activeMember.id;
      const filter = `and(sender_id.eq.${currentUserId},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${currentUserId})`;
      const { data, error } = await client.from("ber_messages")
        .select("id, sender_id, recipient_id, content, created_at, message_type, attachment_path, attachment_name, attachment_mime, attachment_size, deleted_at")
        .or(filter)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(100);
      if (error) throw error;
      await renderMessages(data || [], token);
      if (token === lastLoadToken) setStatus("Conversation ouverte. Les nouveaux messages apparaîtront automatiquement.");
    } catch (error) {
      console.error("B.E.R. chargement conversation:", error);
      setStatus("Impossible de charger la conversation : " + error.message);
    } finally {
      loading = false;
    }
  }

  function activateRealtime() {
    if (channel) return;
    channel = client.channel("ber-chat-enhanced-" + currentUserId)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ber_messages" }, (payload) => {
        const row = payload.new;
        if (activeMember && (
          (row.sender_id === currentUserId && row.recipient_id === activeMember.id) ||
          (row.sender_id === activeMember.id && row.recipient_id === currentUserId)
        )) loadConversation();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "ber_message_receipts" }, () => {
        if (activeMember) loadConversation();
      })
      .subscribe();
  }

  async function sendCurrentMessage() {
    if (!activeMember) { setStatus("Choisissez puis ouvrez une conversation."); return; }
    if (loading) return;
    const content = input.value.trim();
    const file = fileInput.files?.[0] || null;
    if (!content && !file) { setStatus("Écrivez un message ou choisissez un fichier."); return; }
    if (file && file.size > MAX_BYTES) { setStatus("Fichier trop volumineux : maximum 15 Mo."); return; }
    if (file && !ALLOWED_TYPES.has(file.type)) { setStatus("Format non accepté par le stockage B.E.R."); return; }

    sendButton.disabled = true;
    setStatus(file ? "Envoi du fichier sécurisé…" : "Envoi du message…");
    let uploadedPath = null;
    try {
      const message = {
        sender_id: currentUserId,
        recipient_id: activeMember.id,
        content: content || (file ? "Pièce jointe" : null),
        message_type: file ? (file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : "file") : "text"
      };

      if (file) {
        const cleanName = file.name.replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 120) || "fichier";
        uploadedPath = `${currentUserId}/${activeMember.id}/${Date.now()}_${cleanName}`;
        const { error: uploadError } = await client.storage.from(BUCKET).upload(uploadedPath, file, {
          cacheControl: "3600", upsert: false, contentType: file.type
        });
        if (uploadError) throw uploadError;
        message.attachment_path = uploadedPath;
        message.attachment_name = file.name;
        message.attachment_mime = file.type;
        message.attachment_size = file.size;
      }

      const { error } = await client.from("ber_messages").insert(message);
      if (error) throw error;
      input.value = "";
      fileInput.value = "";
      await loadConversation();
      setStatus("Message envoyé.");
    } catch (error) {
      console.error("B.E.R. envoi:", error);
      if (uploadedPath) {
        const { error: removeError } = await client.storage.from(BUCKET).remove([uploadedPath]);
        if (removeError) console.warn("Nettoyage pièce jointe:", removeError.message);
      }
      setStatus("Échec de l'envoi : " + error.message);
    } finally {
      sendButton.disabled = false;
    }
  }

  openButton?.addEventListener("click", async () => {
    const id = memberSelect.value;
    if (!id) { setStatus("Choisissez d'abord un membre."); return; }
    const option = memberSelect.options[memberSelect.selectedIndex];
    const name = option.textContent;
    const avatarPath = option.dataset.avatarPath || null;
    activeMember = {
      id,
      name,
      avatarUrl: publicProfileUrl(avatarPath)
    };
    chatName.textContent = activeMember.name;
    chatHint.textContent = "Conversation privée";
    showMemberAvatar(activeMember);
    showEmpty("Ouverture de la conversation…");
    await loadConversation();
  });

  sendButton.addEventListener("click", sendCurrentMessage);
  input?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendCurrentMessage();
    }
  });

  async function init() {
    try {
      showFallbackAvatar("B.E.R.");
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      if (!data.session) return;
      currentUserId = data.session.user.id;
      await loadMembers();
      activateRealtime();
      setStatus("Messagerie prête. Sélectionnez un membre pour commencer.");
    } catch (error) {
      console.error("B.E.R. messagerie:", error);
      setStatus("Messagerie indisponible : " + error.message);
    }
  }

  init();
})();
