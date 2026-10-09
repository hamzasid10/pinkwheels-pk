create or replace function public.grant_owner_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(new.email) = 'hamza.icaruss@gmail.com' and new.email_confirmed_at is not null then
    insert into public.user_roles (user_id, role)
    select new.id, 'admin'::public.app_role
    where not exists (select 1 from public.user_roles where user_id = new.id and role = 'admin');
  end if;
  return new;
end;
$$;

revoke all on function public.grant_owner_admin() from public, anon, authenticated;

drop trigger if exists grant_owner_admin_trg on auth.users;
create trigger grant_owner_admin_trg
after insert or update of email_confirmed_at on auth.users
for each row execute function public.grant_owner_admin();