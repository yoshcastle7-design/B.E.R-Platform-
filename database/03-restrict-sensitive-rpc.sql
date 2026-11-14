-- Appliqué au projet Supabase B.E.R-Platform.
-- Fonctions déclencheurs : pas d'appel direct depuis la Data API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- RPC métier : authentification requise ; les fonctions gardent leurs contrôles internes.
revoke execute on function public.review_crowdfunding_campaign(uuid, text, text) from public, anon, authenticated;
grant execute on function public.review_crowdfunding_campaign(uuid, text, text) to authenticated;
revoke execute on function public.submit_crowdfunding_campaign(uuid) from public, anon, authenticated;
grant execute on function public.submit_crowdfunding_campaign(uuid) to authenticated;

-- Progression agrégée des campagnes actives : lecture publique volontaire.
revoke execute on function public.get_campaign_progress(uuid) from public, anon, authenticated;
grant execute on function public.get_campaign_progress(uuid) to anon, authenticated;
