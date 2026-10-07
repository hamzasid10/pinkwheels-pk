CREATE TYPE public.pool_route_status AS ENUM ('open','almost_full','full','started','completed','cancelled','suspended');
CREATE TYPE public.pool_request_status AS ENUM ('pending','accepted','declined','cancelled','completed');

CREATE TABLE public.app_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  pool_fee_type text NOT NULL DEFAULT 'percent' CHECK (pool_fee_type IN ('percent','fixed')),
  pool_fee_value numeric NOT NULL DEFAULT 10,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.app_settings (id) VALUES (1);
GRANT SELECT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings read" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings admin update" ON public.app_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.pool_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.drivers(user_id),
  driver_first_name text NOT NULL,
  driver_rating numeric NOT NULL DEFAULT 5.0,
  vehicle_id uuid REFERENCES public.vehicles(id),
  vehicle_kind public.vehicle_kind NOT NULL,
  vehicle_label text NOT NULL DEFAULT '',
  start_location text NOT NULL,
  destination text NOT NULL,
  departure_date date NOT NULL,
  departure_time time NOT NULL,
  flexible_minutes int NOT NULL DEFAULT 0 CHECK (flexible_minutes IN (0,10,15,30)),
  total_seats int NOT NULL CHECK (total_seats BETWEEN 1 AND 6),
  available_seats int NOT NULL DEFAULT 0,
  price_per_seat int NOT NULL CHECK (price_per_seat > 0),
  max_route_deviation int NOT NULL DEFAULT 2 CHECK (max_route_deviation IN (1,2,3)),
  notes text,
  status public.pool_route_status NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.pool_routes TO authenticated;
GRANT ALL ON public.pool_routes TO service_role;
ALTER TABLE public.pool_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pool read" ON public.pool_routes FOR SELECT TO authenticated
  USING (status NOT IN ('suspended') OR driver_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "pool insert" ON public.pool_routes FOR INSERT TO authenticated
  WITH CHECK (driver_id = auth.uid() AND EXISTS (SELECT 1 FROM public.drivers d WHERE d.user_id = auth.uid() AND d.status = 'approved'));
CREATE POLICY "pool update" ON public.pool_routes FOR UPDATE TO authenticated
  USING (driver_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.pool_seat_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_route_id uuid NOT NULL REFERENCES public.pool_routes(id) ON DELETE CASCADE,
  rider_id uuid NOT NULL,
  rider_first_name text NOT NULL,
  pickup_location text NOT NULL,
  dropoff_location text NOT NULL,
  seats_requested int NOT NULL DEFAULT 1 CHECK (seats_requested BETWEEN 1 AND 6),
  fare int NOT NULL DEFAULT 0,
  deviation_km numeric NOT NULL DEFAULT 0,
  emergency_contact text NOT NULL,
  request_status public.pool_request_status NOT NULL DEFAULT 'pending',
  trip_pin text NOT NULL DEFAULT lpad((floor(random()*10000))::int::text, 4, '0'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.pool_seat_requests TO authenticated;
GRANT ALL ON public.pool_seat_requests TO service_role;
ALTER TABLE public.pool_seat_requests ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_pool_driver(_route uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.pool_routes WHERE id = _route AND driver_id = _user)
$$;

CREATE POLICY "seat read" ON public.pool_seat_requests FOR SELECT TO authenticated
  USING (rider_id = auth.uid() OR public.is_pool_driver(pool_route_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "seat insert" ON public.pool_seat_requests FOR INSERT TO authenticated
  WITH CHECK (rider_id = auth.uid() AND request_status = 'pending'
    AND NOT public.is_pool_driver(pool_route_id, auth.uid())
    AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.suspended));
CREATE POLICY "seat update" ON public.pool_seat_requests FOR UPDATE TO authenticated
  USING (rider_id = auth.uid() OR public.is_pool_driver(pool_route_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));

-- Seat request: set fare on insert, validate availability
CREATE OR REPLACE FUNCTION public.pool_seat_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.pool_routes;
BEGIN
  SELECT * INTO r FROM public.pool_routes WHERE id = NEW.pool_route_id;
  IF r.status NOT IN ('open','almost_full') THEN RAISE EXCEPTION 'This route is not accepting requests'; END IF;
  IF NEW.seats_requested > r.available_seats THEN RAISE EXCEPTION 'Not enough seats available'; END IF;
  NEW.fare := r.price_per_seat * NEW.seats_requested;
  NEW.request_status := 'pending';
  RETURN NEW;
END $$;
CREATE TRIGGER pool_seat_before_insert BEFORE INSERT ON public.pool_seat_requests
  FOR EACH ROW EXECUTE FUNCTION public.pool_seat_before_insert();

-- Seat request updates: role-based transitions
CREATE OR REPLACE FUNCTION public.guard_pool_seat_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.pool_routes; is_drv boolean;
BEGIN
  NEW.updated_at := now();
  IF public.has_role(auth.uid(),'admin') OR auth.uid() IS NULL THEN RETURN NEW; END IF;
  NEW.pool_route_id := OLD.pool_route_id; NEW.rider_id := OLD.rider_id; NEW.fare := OLD.fare;
  NEW.trip_pin := OLD.trip_pin; NEW.seats_requested := OLD.seats_requested;
  IF NEW.request_status = OLD.request_status THEN RETURN NEW; END IF;
  SELECT * INTO r FROM public.pool_routes WHERE id = OLD.pool_route_id;
  is_drv := r.driver_id = auth.uid();
  IF is_drv THEN
    IF OLD.request_status = 'pending' AND NEW.request_status IN ('accepted','declined') THEN
      IF NEW.request_status = 'accepted' AND OLD.seats_requested > r.available_seats THEN
        RAISE EXCEPTION 'Not enough seats left';
      END IF;
      RETURN NEW;
    END IF;
    IF OLD.request_status = 'accepted' AND NEW.request_status IN ('completed','cancelled') THEN RETURN NEW; END IF;
  ELSIF OLD.rider_id = auth.uid() THEN
    IF OLD.request_status IN ('pending','accepted') AND NEW.request_status = 'cancelled' THEN RETURN NEW; END IF;
  END IF;
  RAISE EXCEPTION 'Status change not allowed';
END $$;
CREATE TRIGGER guard_pool_seat_update BEFORE UPDATE ON public.pool_seat_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_pool_seat_update();

-- After seat changes, touch route so it recomputes seats
CREATE OR REPLACE FUNCTION public.pool_seat_after_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.pool_routes SET updated_at = now() WHERE id = NEW.pool_route_id;
  RETURN NEW;
END $$;
CREATE TRIGGER pool_seat_after_change AFTER INSERT OR UPDATE ON public.pool_seat_requests
  FOR EACH ROW EXECUTE FUNCTION public.pool_seat_after_change();

-- Route: recompute seats + status; guard driver edits
CREATE OR REPLACE FUNCTION public.guard_pool_route()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE taken int; confirmed int; is_admin boolean;
BEGIN
  is_admin := public.has_role(auth.uid(),'admin');
  IF TG_OP = 'INSERT' THEN
    SELECT split_part(full_name,' ',1), rating INTO NEW.driver_first_name, NEW.driver_rating
      FROM public.drivers WHERE user_id = NEW.driver_id;
    NEW.status := 'open';
    NEW.available_seats := NEW.total_seats;
    RETURN NEW;
  END IF;
  NEW.updated_at := now();
  NEW.driver_id := OLD.driver_id;
  SELECT coalesce(sum(seats_requested),0) INTO taken FROM public.pool_seat_requests
    WHERE pool_route_id = OLD.id AND request_status IN ('accepted','completed');
  confirmed := taken;
  IF NOT is_admin AND auth.uid() = OLD.driver_id THEN
    IF NEW.status = 'suspended' OR (OLD.status = 'suspended' AND NEW.status <> 'cancelled') THEN
      NEW.status := OLD.status;
    END IF;
    IF OLD.status IN ('completed','cancelled') THEN NEW.status := OLD.status; END IF;
    IF confirmed > 0 AND (NEW.start_location <> OLD.start_location OR NEW.destination <> OLD.destination
        OR NEW.departure_date <> OLD.departure_date OR NEW.departure_time <> OLD.departure_time
        OR NEW.price_per_seat <> OLD.price_per_seat) THEN
      RAISE EXCEPTION 'Route details cannot change after passengers are confirmed. Cancel the route instead.';
    END IF;
    IF NEW.total_seats < confirmed THEN RAISE EXCEPTION 'Seats cannot be fewer than confirmed passengers'; END IF;
  END IF;
  NEW.available_seats := greatest(NEW.total_seats - taken, 0);
  IF NEW.status IN ('open','almost_full','full') THEN
    NEW.status := CASE WHEN NEW.available_seats = 0 THEN 'full'
      WHEN NEW.available_seats = 1 AND NEW.total_seats > 1 THEN 'almost_full' ELSE 'open' END;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_pool_route BEFORE INSERT OR UPDATE ON public.pool_routes
  FOR EACH ROW EXECUTE FUNCTION public.guard_pool_route();

-- Route lifecycle cascades to seat requests
CREATE OR REPLACE FUNCTION public.pool_route_after_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF NEW.status IN ('cancelled','suspended') THEN
    UPDATE public.pool_seat_requests SET request_status = 'cancelled'
      WHERE pool_route_id = NEW.id AND request_status IN ('pending','accepted');
  ELSIF NEW.status = 'completed' THEN
    UPDATE public.pool_seat_requests SET request_status = 'completed'
      WHERE pool_route_id = NEW.id AND request_status = 'accepted';
    UPDATE public.pool_seat_requests SET request_status = 'declined'
      WHERE pool_route_id = NEW.id AND request_status = 'pending';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER pool_route_after_status AFTER UPDATE ON public.pool_routes
  FOR EACH ROW EXECUTE FUNCTION public.pool_route_after_status();