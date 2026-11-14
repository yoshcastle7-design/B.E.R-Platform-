-- Appliqué au projet Supabase B.E.R-Platform (xboncmqpwlciovoaamkb)
-- Renforce l'insertion et les transitions des appels WebRTC.

drop policy if exists "Authenticated caller can start call" on public.ber_call_sessions;
create policy "Authenticated caller can start call"
on public.ber_call_sessions for insert to authenticated
with check (
  caller_id = (select auth.uid())
  and callee_id <> (select auth.uid())
  and status = 'ringing'
  and offer is null
  and answer is null
  and ice_candidates = '[]'::jsonb
  and answered_at is null
  and ended_at is null
);

create or replace function public.ber_guard_call_session_update()
returns trigger
language plpgsql
set search_path = public
as $function$
declare
  actor uuid := auth.uid();
begin
  if actor is null or (actor <> old.caller_id and actor <> old.callee_id) then
    raise exception 'Non autorisé';
  end if;
  if new.id is distinct from old.id
     or new.caller_id is distinct from old.caller_id
     or new.callee_id is distinct from old.callee_id
     or new.call_type is distinct from old.call_type
     or new.created_at is distinct from old.created_at then
    raise exception 'Les participants et les paramètres initiaux de l’appel sont immuables';
  end if;
  if new.ice_candidates is distinct from old.ice_candidates then
    raise exception 'Les candidats ICE doivent être enregistrés individuellement';
  end if;
  if old.status in ('ended','rejected','missed','cancelled') then
    raise exception 'Cet appel est déjà terminé';
  end if;
  if old.ended_at is not null and new.ended_at is distinct from old.ended_at then
    raise exception 'La date de fin est immuable';
  end if;
  if actor = old.caller_id then
    if new.answer is distinct from old.answer or new.answered_at is distinct from old.answered_at then
      raise exception 'Seul le destinataire peut répondre à un appel';
    end if;
    if new.status not in (old.status, 'cancelled', 'ended') then
      raise exception 'Transition d’appel non autorisée';
    end if;
    if old.status = 'accepted' and new.status = 'cancelled' then
      raise exception 'Un appel accepté doit être terminé, pas annulé';
    end if;
    if new.offer is distinct from old.offer then
      if old.status <> 'ringing' or old.offer is not null or new.offer is null then
        raise exception 'L’offre ne peut être définie qu’une seule fois par l’appelant';
      end if;
    end if;
  else
    if new.offer is distinct from old.offer then
      raise exception 'Seul l’appelant peut définir l’offre';
    end if;
    if new.status not in (old.status, 'accepted', 'rejected', 'missed', 'ended') then
      raise exception 'Transition d’appel non autorisée';
    end if;
    if old.status <> 'ringing' and new.status in ('accepted','rejected','missed') then
      raise exception 'La réponse à cet appel a déjà été traitée';
    end if;
    if new.answer is distinct from old.answer then
      if old.status <> 'ringing' or new.status <> 'accepted'
         or old.answer is not null or new.answer is null then
        raise exception 'La réponse WebRTC ne peut être définie qu’une seule fois lors de l’acceptation';
      end if;
    end if;
    if new.status = 'accepted' and new.answer is null then
      raise exception 'Une réponse WebRTC est nécessaire pour accepter l’appel';
    end if;
    if new.status = 'accepted' then
      if old.answered_at is null then new.answered_at := now();
      else new.answered_at := old.answered_at; end if;
    elsif new.answered_at is distinct from old.answered_at then
      raise exception 'Horodatage de réponse non autorisé';
    end if;
  end if;
  if new.status in ('ended','rejected','missed','cancelled') then
    if old.ended_at is null then new.ended_at := now(); end if;
  elsif new.ended_at is distinct from old.ended_at then
    raise exception 'La date de fin ne peut être définie que lors de la clôture';
  end if;
  return new;
end;
$function$;

alter table public.ber_call_ice_candidates
  drop constraint if exists ber_call_ice_candidate_payload_check;
alter table public.ber_call_ice_candidates
  add constraint ber_call_ice_candidate_payload_check
  check (jsonb_typeof(candidate) = 'object' and pg_column_size(candidate) <= 8192);

create index if not exists ber_call_sessions_caller_status_idx
  on public.ber_call_sessions (caller_id, status, created_at);
create index if not exists ber_call_ice_candidates_session_created_idx
  on public.ber_call_ice_candidates (session_id, created_at);
