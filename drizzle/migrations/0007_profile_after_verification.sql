CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare r text := coalesce(new.raw_user_meta_data->>'role','rider');
begin
  -- Only set up the account once the email or phone has been verified
  if new.email_confirmed_at is null and new.phone_confirmed_at is null then return new; end if;
  if exists (select 1 from public.profiles where id = new.id) then return new; end if;
  if r not in ('rider','driver') then r := 'rider'; end if;
  insert into public.profiles (id, full_name, phone)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
          coalesce(new.raw_user_meta_data->>'phone', nullif(new.phone,'')))
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, r::public.app_role) on conflict do nothing;
  if r = 'rider' then insert into public.riders (user_id) values (new.id) on conflict do nothing; end if;
  return new;
end $function$;

DROP TRIGGER IF EXISTS on_auth_user_verified ON auth.users;
CREATE TRIGGER on_auth_user_verified AFTER UPDATE OF email_confirmed_at, phone_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();