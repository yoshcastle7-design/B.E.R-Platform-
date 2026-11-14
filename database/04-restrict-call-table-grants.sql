-- Appliqué au projet Supabase B.E.R-Platform.
-- Anon n'a aucun privilège direct sur les tables d'appel.
revoke all privileges on table public.ber_call_sessions from anon;
revoke all privileges on table public.ber_call_ice_candidates from anon;

-- RLS ne protège pas TRUNCATE : on retire aussi les privilèges inutiles.
revoke delete, truncate, references, trigger
on table public.ber_call_sessions from authenticated;

-- Les candidats ICE sont en ajout/lecture uniquement côté navigateur.
revoke update, delete, truncate, references, trigger
on table public.ber_call_ice_candidates from authenticated;
