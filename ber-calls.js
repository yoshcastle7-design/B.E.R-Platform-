/* B.E.R. PLATFORM — Appels audio/vidéo WebRTC
 * Dépend de window.berSupabase (supabase.js) et des tables
 * public.ber_call_sessions + public.ber_call_ice_candidates.
 * À charger après le client Supabase et le DOM du tableau de bord.
 */
(() => {
  'use strict';

  const start = () => {
    const supabase = window.berSupabase;
    if (!supabase) {
      console.error('[BER Calls] Client Supabase introuvable : vérifie supabase.js.');
      return;
    }

    const memberSelect = document.getElementById('berChatMember');
    const actions = document.querySelector('.ber-chat-actions');
    if (!memberSelect || !actions) {
      console.warn('[BER Calls] Sélecteur de membre ou zone .ber-chat-actions absent.');
      return;
    }

    const state = {
      user: null,
      active: null,
      pending: null,
      pc: null,
      localStream: null,
      remoteStream: null,
      sessionChannel: null,
      candidateChannel: null,
      inboxChannel: null,
      queuedCandidates: [],
      seenIncoming: new Set(),
      panel: null,
      status: null,
      remoteVideo: null,
      localVideo: null,
      remoteAudio: null,
      controls: null,
      micMuted: false,
      cameraDisabled: false
    };

    const ICE_SERVERS = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ];

    const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));

    function ensurePanel() {
      if (state.panel) return;
      const panel = document.createElement('section');
      panel.id = 'berCallPanel';
      panel.className = 'ber-call-panel';
      panel.hidden = true;
      panel.setAttribute('aria-live', 'polite');
      panel.innerHTML = `
        <div class="ber-call-card" role="dialog" aria-modal="true" aria-labelledby="berCallTitle">
          <div class="ber-call-top">
            <div><strong id="berCallTitle">Appel B.E.R.</strong><p id="berCallStatus">Prêt</p></div>
            <button type="button" class="ber-call-close" data-call-action="close" aria-label="Fermer">×</button>
          </div>
          <div class="ber-call-videos" hidden>
            <video id="berCallRemoteVideo" autoplay playsinline></video>
            <video id="berCallLocalVideo" autoplay muted playsinline></video>
          </div>
          <audio id="berCallRemoteAudio" autoplay></audio>
          <div class="ber-call-controls" id="berCallControls"></div>
          <p class="ber-call-note">Autorise le microphone ou la caméra lorsque le navigateur le demande. Les appels nécessitent une connexion HTTPS.</p>
        </div>`;
      document.body.appendChild(panel);
      state.panel = panel;
      state.status = panel.querySelector('#berCallStatus');
      state.remoteVideo = panel.querySelector('#berCallRemoteVideo');
      state.localVideo = panel.querySelector('#berCallLocalVideo');
      state.remoteAudio = panel.querySelector('#berCallRemoteAudio');
      state.controls = panel.querySelector('#berCallControls');
      panel.addEventListener('click', onPanelClick);
    }

    function addCallButtons() {
      if (actions.querySelector('[data-ber-call-button]')) return;
      const audio = document.createElement('button');
      audio.type = 'button';
      audio.className = 'ber-call-action';
      audio.dataset.berCallButton = 'audio';
      audio.textContent = '📞 Audio';
      audio.setAttribute('aria-label', 'Démarrer un appel audio');
      const video = document.createElement('button');
      video.type = 'button';
      video.className = 'ber-call-action';
      video.dataset.berCallButton = 'video';
      video.textContent = '📹 Vidéo';
      video.setAttribute('aria-label', 'Démarrer un appel vidéo');
      audio.addEventListener('click', () => startCall('audio'));
      video.addEventListener('click', () => startCall('video'));
      actions.append(audio, video);
    }

    function showPanel(title, message, buttons = []) {
      ensurePanel();
      state.panel.hidden = false;
      state.panel.querySelector('#berCallTitle').textContent = title;
      state.status.textContent = message;
      state.controls.replaceChildren();
      buttons.forEach(({ action, label, kind = '' }) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `ber-call-button ${kind}`.trim();
        button.dataset.callAction = action;
        button.textContent = label;
        state.controls.appendChild(button);
      });
    }

    function setStatus(message) {
      ensurePanel();
      state.status.textContent = message;
    }

    function selectedMemberId() {
      return memberSelect.value || '';
    }

    function selectedMemberName() {
      const option = memberSelect.options[memberSelect.selectedIndex];
      return option?.textContent?.trim() || 'ce membre';
    }

    async function getLocalMedia(type) {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Microphone/caméra indisponible. Utilise le site en HTTPS dans un navigateur compatible.');
      }
      return navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: type === 'video' ? { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } : false
      });
    }

    function attachLocalMedia(stream, type) {
      state.localStream = stream;
      if (type === 'video') {
        state.panel.querySelector('.ber-call-videos').hidden = false;
        state.localVideo.srcObject = stream;
      }
    }

    function attachRemoteMedia(stream, type) {
      state.remoteStream = stream;
      if (type === 'video') {
        state.panel.querySelector('.ber-call-videos').hidden = false;
        state.remoteVideo.srcObject = stream;
      } else {
        state.remoteAudio.srcObject = stream;
      }
      const target = type === 'video' ? state.remoteVideo : state.remoteAudio;
      target.play?.().catch(() => {});
    }

    function createPeerConnection(sessionId, type) {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      state.pc = pc;
      state.queuedCandidates = [];
      const remote = new MediaStream();
      pc.ontrack = (event) => {
        const incoming = event.streams?.[0];
        if (incoming) incoming.getTracks().forEach((track) => remote.addTrack(track));
        else remote.addTrack(event.track);
        attachRemoteMedia(remote, type);
      };
      pc.onicecandidate = async (event) => {
        if (!event.candidate || !state.active || state.active.id !== sessionId) return;
        try {
          const { error } = await supabase.from('ber_call_ice_candidates').insert({
            session_id: sessionId,
            sender_id: state.user.id,
            candidate: event.candidate.toJSON()
          });
          if (error) console.warn('[BER Calls] Candidat ICE non envoyé :', error.message);
        } catch (error) {
          console.warn('[BER Calls] Erreur ICE :', error);
        }
      };
      pc.onconnectionstatechange = () => {
        if (!state.active || state.active.id !== sessionId) return;
        if (pc.connectionState === 'connected') setStatus('Appel connecté');
        if (pc.connectionState === 'failed') setStatus('Connexion impossible. Un serveur TURN peut être nécessaire sur ce réseau.');
        if (pc.connectionState === 'disconnected') setStatus('Connexion interrompue…');
      };
      state.localStream?.getTracks().forEach((track) => pc.addTrack(track, state.localStream));
      return pc;
    }

    async function flushQueuedCandidates() {
      if (!state.pc?.remoteDescription) return;
      const queued = state.queuedCandidates.splice(0);
      for (const candidate of queued) {
        try { await state.pc.addIceCandidate(new RTCIceCandidate(candidate)); }
        catch (error) { console.warn('[BER Calls] Candidat ICE ignoré :', error); }
      }
    }

    async function receiveCandidate(row) {
      if (!state.active || row.session_id !== state.active.id || row.sender_id === state.user.id) return;
      if (!state.pc?.remoteDescription) {
        state.queuedCandidates.push(row.candidate);
        return;
      }
      try { await state.pc.addIceCandidate(new RTCIceCandidate(row.candidate)); }
      catch (error) { console.warn('[BER Calls] Candidat ICE ignoré :', error); }
    }

    async function subscribeToSession(sessionId) {
      if (state.sessionChannel) await supabase.removeChannel(state.sessionChannel);
      if (state.candidateChannel) await supabase.removeChannel(state.candidateChannel);

      state.sessionChannel = supabase.channel(`ber-call-session-${sessionId}`)
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'ber_call_sessions', filter: `id=eq.${sessionId}`
        }, async ({ new: row }) => {
          if (!state.active || row.id !== state.active.id) return;
          if (state.active.role === 'caller' && row.answer && !state.pc?.remoteDescription) {
            try {
              await state.pc.setRemoteDescription(new RTCSessionDescription(row.answer));
              await flushQueuedCandidates();
              setStatus('Réponse reçue — connexion en cours…');
            } catch (error) {
              setStatus('Impossible de traiter la réponse de l’appel.');
              console.error(error);
            }
          }
          if (['ended', 'rejected', 'missed', 'cancelled'].includes(row.status)) {
            setStatus(row.status === 'rejected' ? 'Appel refusé' : row.status === 'missed' ? 'Appel manqué' : 'Appel terminé');
            setTimeout(cleanupCall, 900);
          }
        }).subscribe();

      state.candidateChannel = supabase.channel(`ber-call-ice-${sessionId}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'ber_call_ice_candidates', filter: `session_id=eq.${sessionId}`
        }, ({ new: row }) => receiveCandidate(row))
        .subscribe();

      // Récupère aussi les candidats publiés avant l'abonnement Realtime.
      const { data, error } = await supabase.from('ber_call_ice_candidates')
        .select('id,session_id,sender_id,candidate,created_at')
        .eq('session_id', sessionId).order('created_at', { ascending: true });
      if (!error && Array.isArray(data)) {
        for (const row of data) await receiveCandidate(row);
      }
    }

    async function startCall(type) {
      if (state.active || state.pending) return alert('Un appel est déjà en cours ou en attente.');
      const peerId = selectedMemberId();
      if (!peerId) return alert('Choisis d’abord un membre dans la liste de messagerie.');
      if (peerId === state.user.id) return alert('Tu ne peux pas t’appeler toi-même.');
      try {
        showPanel(`Appel ${type === 'video' ? 'vidéo' : 'audio'}`, 'Activation du microphone et de la caméra…');
        const stream = await getLocalMedia(type);
        attachLocalMedia(stream, type);
        const { data: session, error } = await supabase.from('ber_call_sessions').insert({
          caller_id: state.user.id,
          callee_id: peerId,
          call_type: type,
          status: 'ringing'
        }).select('id,caller_id,callee_id,call_type,status').single();
        if (error) throw error;
        state.active = { id: session.id, callerId: state.user.id, calleeId: peerId, type, role: 'caller' };
        const pc = createPeerConnection(session.id, type);
        await subscribeToSession(session.id);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        const { error: updateError } = await supabase.from('ber_call_sessions')
          .update({ offer: pc.localDescription.toJSON() }).eq('id', session.id);
        if (updateError) throw updateError;
        showInCallControls(type);
        setStatus(`Appel de ${selectedMemberName()}…`);
        if (type === 'video') {
          state.panel.querySelector('.ber-call-videos').hidden = false;
          state.localVideo.srcObject = stream;
        }
      } catch (error) {
        console.error('[BER Calls] Démarrage impossible :', error);
        alert(`Impossible de démarrer l’appel : ${error.message || 'erreur inconnue'}`);
        await cleanupCall();
      }
    }

    async function acceptCall() {
      const row = state.pending;
      if (!row || state.active) return;
      try {
        setStatus('Activation du microphone et de la caméra…');
        let latest = null;
        for (let attempt = 0; attempt < 8; attempt++) {
          const result = await supabase.from('ber_call_sessions')
            .select('*').eq('id', row.id).single();
          if (result.error) throw result.error;
          latest = result.data;
          if (latest?.offer || latest?.status !== 'ringing') break;
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
        if (!latest || latest.status !== 'ringing' || !latest.offer) {
          throw new Error('L’appel vient d’être lancé. Attends un instant puis réessaie.');
        }
        const stream = await getLocalMedia(latest.call_type);
        state.active = { id: latest.id, callerId: latest.caller_id, calleeId: latest.callee_id, type: latest.call_type, role: 'callee' };
        state.pending = null;
        attachLocalMedia(stream, latest.call_type);
        const pc = createPeerConnection(latest.id, latest.call_type);
        await pc.setRemoteDescription(new RTCSessionDescription(latest.offer));
        await subscribeToSession(latest.id);
        await flushQueuedCandidates();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        const { error: updateError } = await supabase.from('ber_call_sessions')
          .update({ answer: pc.localDescription.toJSON(), status: 'accepted' }).eq('id', latest.id);
        if (updateError) throw updateError;
        showPanel('Appel en cours', 'Connexion en cours…');
        showInCallControls(latest.call_type);
        if (latest.call_type === 'video') {
          state.panel.querySelector('.ber-call-videos').hidden = false;
          state.localVideo.srcObject = stream;
        }
      } catch (error) {
        console.error('[BER Calls] Acceptation impossible :', error);
        alert(`Impossible de répondre : ${error.message || 'erreur inconnue'}`);
        if (state.pending?.id) {
          await supabase.from('ber_call_sessions').update({ status: 'rejected' }).eq('id', state.pending.id);
        }
        await cleanupCall();
      }
    }

    function showInCallControls(type) {
      const buttons = [
        { action: 'mute', label: state.micMuted ? 'Réactiver micro' : 'Couper micro' }
      ];
      if (type === 'video') buttons.push({ action: 'camera', label: state.cameraDisabled ? 'Réactiver caméra' : 'Couper caméra' });
      buttons.push({ action: 'hangup', label: 'Terminer', kind: 'danger' });
      showPanel('Appel en cours', 'Connexion en cours…', buttons);
    }

    function toggleMicrophone(button) {
      if (!state.localStream) return;
      state.micMuted = !state.micMuted;
      state.localStream.getAudioTracks().forEach((track) => { track.enabled = !state.micMuted; });
      button.textContent = state.micMuted ? 'Réactiver micro' : 'Couper micro';
    }

    function toggleCamera(button) {
      if (!state.localStream) return;
      state.cameraDisabled = !state.cameraDisabled;
      state.localStream.getVideoTracks().forEach((track) => { track.enabled = !state.cameraDisabled; });
      button.textContent = state.cameraDisabled ? 'Réactiver caméra' : 'Couper caméra';
    }

    async function rejectCall() {
      const row = state.pending;
      if (!row) return;
      await supabase.from('ber_call_sessions').update({ status: 'rejected' }).eq('id', row.id);
      state.pending = null;
      state.panel.hidden = true;
    }

    async function hangup() {
      if (!state.active) return cleanupCall();
      const id = state.active.id;
      const { data: latest } = await supabase.from('ber_call_sessions')
        .select('status').eq('id', id).maybeSingle();
      const status = state.active.role === 'caller' && latest?.status === 'ringing' ? 'cancelled' : 'ended';
      if (latest && !['ended','rejected','missed','cancelled'].includes(latest.status)) {
        const { error } = await supabase.from('ber_call_sessions').update({ status }).eq('id', id);
        if (error) console.warn('[BER Calls] Clôture serveur :', error.message);
      }
      await cleanupCall();
    }

    async function cleanupCall() {
      if (state.pc) {
        state.pc.ontrack = null;
        state.pc.onicecandidate = null;
        state.pc.close();
      }
      state.localStream?.getTracks().forEach((track) => track.stop());
      state.localStream = null;
      state.remoteStream = null;
      state.pc = null;
      state.active = null;
      state.pending = null;
      state.queuedCandidates = [];
      state.micMuted = false;
      state.cameraDisabled = false;
      if (state.sessionChannel) await supabase.removeChannel(state.sessionChannel);
      if (state.candidateChannel) await supabase.removeChannel(state.candidateChannel);
      state.sessionChannel = null;
      state.candidateChannel = null;
      if (state.remoteVideo) state.remoteVideo.srcObject = null;
      if (state.localVideo) state.localVideo.srcObject = null;
      if (state.panel) state.panel.querySelector('.ber-call-videos').hidden = true;
      if (state.remoteAudio) state.remoteAudio.srcObject = null;
      if (state.panel) state.panel.hidden = true;
    }

    async function onPanelClick(event) {
      const button = event.target.closest('[data-call-action]');
      if (!button) return;
      const action = button.dataset.callAction;
      if (action === 'accept') await acceptCall();
      if (action === 'reject') await rejectCall();
      if (action === 'hangup') await hangup();
      if (action === 'mute') toggleMicrophone(button);
      if (action === 'camera') toggleCamera(button);
      if (action === 'close' && !state.active && !state.pending) state.panel.hidden = true;
    }

    function subscribeInbox() {
      state.inboxChannel = supabase.channel(`ber-call-inbox-${state.user.id}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'ber_call_sessions', filter: `callee_id=eq.${state.user.id}`
        }, ({ new: row }) => {
          if (row.callee_id !== state.user.id || row.status !== 'ringing' || state.seenIncoming.has(row.id)) return;
          state.seenIncoming.add(row.id);
          if (state.active || state.pending) {
            supabase.from('ber_call_sessions').update({ status: 'missed' }).eq('id', row.id);
            return;
          }
          state.pending = row;
          const callerName = 'Un membre B.E.R.';
          showPanel(`Appel ${row.call_type === 'video' ? 'vidéo' : 'audio'} entrant`, `${callerName} t’appelle.`, [
            { action: 'accept', label: 'Répondre', kind: 'success' },
            { action: 'reject', label: 'Refuser', kind: 'danger' }
          ]);
        }).subscribe();
    }

    async function init() {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) {
        console.warn('[BER Calls] Utilisateur non connecté : les appels seront activés après connexion.');
        return;
      }
      state.user = data.user;
      ensurePanel();
      addCallButtons();
      subscribeInbox();
      console.log('[BER Calls] Module prêt pour', state.user.id);
    }

    init().catch((error) => console.error('[BER Calls] Initialisation :', error));
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
