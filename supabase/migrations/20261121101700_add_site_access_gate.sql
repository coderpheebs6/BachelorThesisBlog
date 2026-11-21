create extension if not exists pgcrypto with schema extensions;

create table if not exists public.site_access (
  id boolean primary key default true,
  code_salt text not null,
  code_hash text not null,
  constraint one_site_access_row check (id)
);

insert into public.site_access (id, code_salt, code_hash)
values (
  true,
  '06af82c4171439e7673a7bd4f17b6b2d',
  '0e199257f6017912a201a166b0cdcff043c532014ccf19a4d460fb49df54a021'
)
on conflict (id) do update
set code_salt = excluded.code_salt,
    code_hash = excluded.code_hash;

alter table public.site_access enable row level security;

create or replace function public.verify_site_access(submitted_code text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  expected record;
begin
  select code_salt, code_hash
  into expected
  from public.site_access
  where id = true;

  if expected.code_hash is null then
    return false;
  end if;

  return expected.code_hash = encode(
    extensions.digest(
      convert_to(submitted_code || expected.code_salt, 'UTF8'),
      'sha256'
    ),
    'hex'
  );
end;
$$;

revoke all on function public.verify_site_access(text) from public;
grant execute on function public.verify_site_access(text) to anon, authenticated;
