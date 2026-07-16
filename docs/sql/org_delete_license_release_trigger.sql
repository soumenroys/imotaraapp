-- Ensures deleting an organisation automatically frees its members' licenses,
-- no matter what deletes the org row (the owner self-delete route, any
-- future admin tooling, or direct SQL in the editor). licenses.org_id is
-- ON DELETE SET NULL, not CASCADE, so without this a deleted org's former
-- members would keep their org-derived paid tier permanently, with no org
-- behind it. Runs BEFORE DELETE, inside the same transaction as the delete.

create or replace function release_licenses_on_org_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update licenses
  set org_id = null,
      tier = 'free',
      status = 'valid',
      expires_at = null,
      source = 'manual',
      updated_at = now()
  where org_id = old.id;
  return old;
end;
$$;

drop trigger if exists trg_release_licenses_on_org_delete on organizations;

create trigger trg_release_licenses_on_org_delete
before delete on organizations
for each row
execute function release_licenses_on_org_delete();
