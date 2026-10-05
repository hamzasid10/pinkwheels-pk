
create type public.app_role as enum ('admin','driver','rider');
create type public.ride_status as enum ('requested','driver_assigned','driver_arriving','ride_started','completed','cancelled');
create type public.driver_status as enum ('pending','approved','rejected','suspended');
create type public.vehicle_kind as enum ('car','scooty','bike');

create table public.profiles (
  id uuid primary key,
  full_name text not null default '',
  phone text,
  city text,
  suspended boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "own roles read" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());

create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'admin') then new.suspended := old.suspended; end if;
  return new;
end $$;
create trigger guard_profile_update before update on public.profiles for each row execute function public.guard_profile_update();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare r text := coalesce(new.raw_user_meta_data->>'role','rider');
begin
  if r not in ('rider','driver') then r := 'rider'; end if;
  insert into public.profiles (id, full_name, phone)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''), new.raw_user_meta_data->>'phone');
  insert into public.user_roles (user_id, role) values (new.id, r::public.app_role);
  if r = 'rider' then insert into public.riders (user_id) values (new.id); end if;
  return new;
end $$;

create table public.riders (
  user_id uuid primary key,
  default_city text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.riders to authenticated;
grant all on public.riders to service_role;
alter table public.riders enable row level security;
create policy "rider own" on public.riders for all to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin')) with check (user_id = auth.uid());

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.drivers (
  user_id uuid primary key,
  full_name text not null,
  phone text not null,
  email text not null,
  cnic text not null,
  licence_no text not null,
  city text not null,
  working_hours text,
  emergency_contact text,
  status public.driver_status not null default 'pending',
  online boolean not null default false,
  rating numeric(2,1) not null default 5.0,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.drivers to authenticated;
grant all on public.drivers to service_role;
alter table public.drivers enable row level security;
create policy "driver read" on public.drivers for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "driver insert" on public.drivers for insert to authenticated with check (user_id = auth.uid() and status = 'pending');
create policy "driver update self" on public.drivers for update to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create or replace function public.guard_driver_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'admin') then
    new.status := old.status;
    new.rating := old.rating;
  end if;
  return new;
end $$;
create trigger guard_driver_update before update on public.drivers for each row execute function public.guard_driver_update();

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(user_id) on delete cascade,
  kind public.vehicle_kind not null,
  make_model text not null,
  reg_no text not null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.vehicles to authenticated;
grant all on public.vehicles to service_role;
alter table public.vehicles enable row level security;
create policy "vehicle own" on public.vehicles for all to authenticated using (driver_id = auth.uid() or public.has_role(auth.uid(),'admin')) with check (driver_id = auth.uid());

create table public.driver_documents (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(user_id) on delete cascade,
  doc_type text not null,
  file_path text not null,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.driver_documents to authenticated;
grant all on public.driver_documents to service_role;
alter table public.driver_documents enable row level security;
create policy "docs read" on public.driver_documents for select to authenticated using (driver_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "docs insert" on public.driver_documents for insert to authenticated with check (driver_id = auth.uid());
create policy "docs admin update" on public.driver_documents for update to authenticated using (public.has_role(auth.uid(),'admin'));

create table public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  phone text not null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.emergency_contacts to authenticated;
grant all on public.emergency_contacts to service_role;
alter table public.emergency_contacts enable row level security;
create policy "ec own" on public.emergency_contacts for all to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin')) with check (user_id = auth.uid());

create table public.saved_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  label text not null,
  address text not null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.saved_locations to authenticated;
grant all on public.saved_locations to service_role;
alter table public.saved_locations enable row level security;
create policy "loc own" on public.saved_locations for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.ride_requests (
  id uuid primary key default gen_random_uuid(),
  booking_code text not null default ('PW-' || upper(substr(md5(random()::text),1,6))),
  rider_id uuid not null,
  rider_name text not null,
  rider_phone text not null,
  emergency_contact text not null,
  pickup text not null,
  destination text not null,
  ride_date date not null,
  ride_time time not null,
  vehicle public.vehicle_kind not null,
  fare integer not null,
  status public.ride_status not null default 'requested',
  trip_pin text not null default lpad((floor(random()*10000))::int::text, 4, '0'),
  driver_id uuid,
  driver_name text,
  driver_phone text,
  driver_vehicle text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.ride_requests to authenticated;
grant all on public.ride_requests to service_role;
alter table public.ride_requests enable row level security;
create policy "ride read" on public.ride_requests for select to authenticated using (rider_id = auth.uid() or driver_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "ride insert" on public.ride_requests for insert to authenticated with check (rider_id = auth.uid() and status = 'requested' and driver_id is null);
create policy "ride update" on public.ride_requests for update to authenticated using (rider_id = auth.uid() or driver_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create or replace function public.guard_ride_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if public.has_role(auth.uid(),'admin') then return new; end if;
  new.driver_id := old.driver_id; new.driver_name := old.driver_name; new.driver_phone := old.driver_phone;
  new.driver_vehicle := old.driver_vehicle; new.fare := old.fare; new.trip_pin := old.trip_pin; new.rider_id := old.rider_id;
  if auth.uid() = old.driver_id then
    if not ((old.status='driver_assigned' and new.status='driver_arriving')
         or (old.status='driver_arriving' and new.status='ride_started')
         or (old.status='ride_started' and new.status='completed')
         or new.status = old.status) then
      raise exception 'Invalid status change';
    end if;
  elsif auth.uid() = old.rider_id then
    if new.status <> old.status and not (new.status='cancelled' and old.status in ('requested','driver_assigned','driver_arriving')) then
      raise exception 'Riders can only cancel';
    end if;
  end if;
  return new;
end $$;
create trigger guard_ride_update before update on public.ride_requests for each row execute function public.guard_ride_update();

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.ride_requests(id) on delete cascade,
  rater_id uuid not null,
  driver_id uuid,
  stars int not null check (stars between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);
grant select, insert on public.ratings to authenticated;
grant all on public.ratings to service_role;
alter table public.ratings enable row level security;
create policy "rating read" on public.ratings for select to authenticated using (rater_id = auth.uid() or driver_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "rating insert" on public.ratings for insert to authenticated with check (rater_id = auth.uid());

create table public.complaints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  ride_id uuid references public.ride_requests(id) on delete set null,
  kind text not null default 'complaint' check (kind in ('complaint','emergency')),
  message text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.complaints to authenticated;
grant all on public.complaints to service_role;
alter table public.complaints enable row level security;
create policy "complaint read" on public.complaints for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "complaint insert" on public.complaints for insert to authenticated with check (user_id = auth.uid());
create policy "complaint admin update" on public.complaints for update to authenticated using (public.has_role(auth.uid(),'admin'));

create policy "driver docs upload" on storage.objects for insert to authenticated with check (bucket_id = 'driver-docs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "driver docs read" on storage.objects for select to authenticated using (bucket_id = 'driver-docs' and ((storage.foldername(name))[1] = auth.uid()::text or public.has_role(auth.uid(),'admin')));
