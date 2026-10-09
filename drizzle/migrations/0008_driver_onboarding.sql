ALTER TYPE public.driver_status ADD VALUE IF NOT EXISTS 'incomplete';
ALTER TYPE public.driver_status ADD VALUE IF NOT EXISTS 'info_requested';

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS guardian_name text,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS home_address text,
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
  ADD COLUMN IF NOT EXISTS licence_expiry date,
  ADD COLUMN IF NOT EXISTS licence_category text,
  ADD COLUMN IF NOT EXISTS admin_note text,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS make text,
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS model_year integer,
  ADD COLUMN IF NOT EXISTS color text;

DROP POLICY IF EXISTS "driver insert" ON public.drivers;
CREATE POLICY "driver insert" ON public.drivers FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status::text IN ('pending','incomplete'));

CREATE OR REPLACE FUNCTION public.guard_driver_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if pg_trigger_depth() > 1 then return new; end if;
  if not public.has_role(auth.uid(),'admin') then
    new.rating := old.rating;
    new.admin_note := old.admin_note;
    new.reviewed_at := old.reviewed_at;
    -- Drivers may only submit (or resubmit) their own application.
    if new.status::text = 'pending' and old.status::text in ('incomplete','rejected','info_requested','pending') then
      if new.licence_expiry is null or new.licence_expiry < current_date then
        raise exception 'Your driving licence is expired or missing an expiry date';
      end if;
      if new.terms_accepted_at is null then
        raise exception 'Please accept the driver terms';
      end if;
      if old.status::text <> 'pending' then new.submitted_at := now(); end if;
    else
      new.status := old.status;
    end if;
    -- Once under review, identity fields are locked for the driver.
    if old.status::text in ('pending','approved','suspended') then
      new.cnic := old.cnic; new.licence_no := old.licence_no; new.full_name := old.full_name;
      new.licence_expiry := old.licence_expiry; new.date_of_birth := old.date_of_birth;
    end if;
  end if;
  if new.status::text <> 'approved' then new.online := false; end if;
  return new;
end $$;

CREATE OR REPLACE FUNCTION public.guard_driver_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if not public.has_role(auth.uid(),'admin') then
    new.online := false; new.admin_note := null; new.reviewed_at := null; new.rating := 5.0;
  end if;
  return new;
end $$;
DROP TRIGGER IF EXISTS guard_driver_insert ON public.drivers;
CREATE TRIGGER guard_driver_insert BEFORE INSERT ON public.drivers FOR EACH ROW EXECUTE FUNCTION public.guard_driver_insert();

-- Only approved drivers can be put on a ride.
CREATE OR REPLACE FUNCTION public.ride_driver_must_be_approved()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if new.driver_id is not null and new.driver_id is distinct from old.driver_id
     and not exists (select 1 from public.drivers d where d.user_id = new.driver_id and d.status::text = 'approved') then
    raise exception 'Only approved drivers can be assigned rides';
  end if;
  return new;
end $$;
DROP TRIGGER IF EXISTS ride_driver_must_be_approved ON public.ride_requests;
CREATE TRIGGER ride_driver_must_be_approved BEFORE UPDATE ON public.ride_requests FOR EACH ROW EXECUTE FUNCTION public.ride_driver_must_be_approved();