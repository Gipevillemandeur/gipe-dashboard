-- =====================================================================
-- GIPE Dashboard — Protection des codes de l'app des conseils
-- A exécuter UNE fois dans Supabase → SQL Editor.
-- Crée une table + une fonction. Ne modifie aucune donnée existante.
--
-- - 3 mauvais codes depuis un même appareil → appareil bloqué pour
--   cette classe ;
-- - 30 mauvais codes au total sur une classe → classe bloquée ;
-- - tout est levé dès que le code de la classe change.
--
-- Les appareils ne sont jamais stockés en clair : seule une
-- empreinte brouillée (non réversible) est conservée.
-- =====================================================================

create table if not exists public.gipe_code_attempts (
  class_id uuid not null references public.classes(id) on delete cascade,
  device text not null,
  code_fingerprint text not null,
  failures integer not null default 0,
  last_attempt_at timestamptz not null default now(),
  primary key (class_id, device, code_fingerprint)
);

-- Accessible uniquement par le serveur du dashboard.
alter table public.gipe_code_attempts enable row level security;


create or replace function public.gipe_register_code_failure(
  p_class_id uuid,
  p_device text,
  p_code_fingerprint text
)
returns jsonb
language plpgsql
as $$
declare
  v_device_failures integer;
  v_class_failures integer;
begin
  insert into public.gipe_code_attempts (class_id, device, code_fingerprint, failures)
  values (p_class_id, p_device, p_code_fingerprint, 1)
  on conflict (class_id, device, code_fingerprint)
  do update set
    failures = public.gipe_code_attempts.failures + 1,
    last_attempt_at = now()
  returning failures into v_device_failures;

  select coalesce(sum(failures), 0)::integer into v_class_failures
  from public.gipe_code_attempts
  where class_id = p_class_id
    and code_fingerprint = p_code_fingerprint;

  -- Petit ménage : essais liés à d'anciens codes (plus de 30 jours).
  delete from public.gipe_code_attempts
  where last_attempt_at < now() - interval '30 days';

  return jsonb_build_object(
    'deviceFailures', v_device_failures,
    'classFailures', v_class_failures
  );
end;
$$;
