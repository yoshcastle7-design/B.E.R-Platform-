-- Appliqué au projet Supabase B.E.R-Platform.
-- Politiques optimisées avec auth.uid() évalué une seule fois par requête.

drop policy if exists "Authenticated caller can start call" on public.ber_call_sessions;
create policy "Authenticated caller can start call"
on public.ber_call_sessions for insert to authenticated
with check (
  caller_id = (select auth.uid()) and callee_id <> (select auth.uid())
  and status = 'ringing' and offer is null and answer is null
  and ice_candidates = '[]'::jsonb and answered_at is null and ended_at is null
);

drop policy if exists "Call participants can read sessions" on public.ber_call_sessions;
create policy "Call participants can read sessions"
on public.ber_call_sessions for select to authenticated
using (caller_id = (select auth.uid()) or callee_id = (select auth.uid()));

drop policy if exists "Call participants can update sessions" on public.ber_call_sessions;
create policy "Call participants can update sessions"
on public.ber_call_sessions for update to authenticated
using (caller_id = (select auth.uid()) or callee_id = (select auth.uid()))
with check (caller_id = (select auth.uid()) or callee_id = (select auth.uid()));

drop policy if exists "Call participants can read ICE candidates" on public.ber_call_ice_candidates;
create policy "Call participants can read ICE candidates"
on public.ber_call_ice_candidates for select to authenticated
using (exists (
  select 1 from public.ber_call_sessions s
  where s.id = session_id
    and (s.caller_id = (select auth.uid()) or s.callee_id = (select auth.uid()))
));

drop policy if exists "Participants can publish own ICE candidates" on public.ber_call_ice_candidates;
create policy "Participants can publish own ICE candidates"
on public.ber_call_ice_candidates for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1 from public.ber_call_sessions s
    where s.id = session_id and s.status in ('ringing','accepted')
      and (s.caller_id = (select auth.uid()) or s.callee_id = (select auth.uid()))
  )
);

drop index if exists public.ber_call_sessions_callee_status_idx;
create index if not exists ber_call_ice_candidates_sender_idx
  on public.ber_call_ice_candidates (sender_id);
