CREATE TABLE public.fare_settings (
  vehicle public.vehicle_kind PRIMARY KEY,
  base_fare integer NOT NULL CHECK (base_fare >= 0),
  per_km numeric NOT NULL CHECK (per_km >= 0),
  per_min numeric NOT NULL DEFAULT 0 CHECK (per_min >= 0),
  min_fare integer NOT NULL DEFAULT 0 CHECK (min_fare >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fare_settings TO authenticated;
GRANT ALL ON public.fare_settings TO service_role;
ALTER TABLE public.fare_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fares read" ON public.fare_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "fares admin write" ON public.fare_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

ALTER TABLE public.profiles ADD COLUMN location_sharing boolean NOT NULL DEFAULT false;

ALTER TABLE public.ride_requests
  ADD COLUMN pickup_lat double precision, ADD COLUMN pickup_lng double precision,
  ADD COLUMN dest_lat double precision, ADD COLUMN dest_lng double precision,
  ADD COLUMN pickup_place_id text, ADD COLUMN dest_place_id text,
  ADD COLUMN distance_km numeric, ADD COLUMN duration_min numeric,
  ADD COLUMN route_polyline text;

ALTER TABLE public.pool_routes
  ADD COLUMN start_lat double precision, ADD COLUMN start_lng double precision,
  ADD COLUMN dest_lat double precision, ADD COLUMN dest_lng double precision,
  ADD COLUMN start_city text, ADD COLUMN distance_km numeric, ADD COLUMN duration_min numeric,
  ADD COLUMN route_polyline text;

ALTER TABLE public.pool_seat_requests
  ADD COLUMN pickup_lat double precision, ADD COLUMN pickup_lng double precision,
  ADD COLUMN dropoff_lat double precision, ADD COLUMN dropoff_lng double precision;

CREATE TABLE public.driver_locations (
  driver_id uuid PRIMARY KEY REFERENCES public.drivers(user_id) ON DELETE CASCADE,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  heading double precision,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.driver_locations TO authenticated;
GRANT ALL ON public.driver_locations TO service_role;
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_share_location(_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.drivers d JOIN public.profiles p ON p.id = d.user_id
    WHERE d.user_id = _user AND d.status = 'approved' AND d.online AND p.location_sharing AND NOT p.suspended)
$$;

CREATE OR REPLACE FUNCTION public.rider_can_track(_driver uuid, _rider uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.ride_requests
    WHERE driver_id = _driver AND rider_id = _rider
      AND status IN ('driver_assigned','driver_arriving','ride_started'))
$$;

CREATE POLICY "loc write own" ON public.driver_locations FOR INSERT TO authenticated
  WITH CHECK (driver_id = auth.uid() AND public.can_share_location(auth.uid()));
CREATE POLICY "loc update own" ON public.driver_locations FOR UPDATE TO authenticated
  USING (driver_id = auth.uid()) WITH CHECK (driver_id = auth.uid() AND public.can_share_location(auth.uid()));
CREATE POLICY "loc read" ON public.driver_locations FOR SELECT TO authenticated
  USING (driver_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.rider_can_track(driver_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.nearby_drivers(_lat double precision, _lng double precision, _radius_km double precision DEFAULT 8)
RETURNS TABLE(lat double precision, lng double precision, vehicle public.vehicle_kind)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT round(l.lat::numeric * 300)::double precision / 300, round(l.lng::numeric * 300)::double precision / 300,
    (SELECT v.kind FROM public.vehicles v WHERE v.driver_id = l.driver_id ORDER BY v.created_at LIMIT 1)
  FROM public.driver_locations l JOIN public.drivers d ON d.user_id = l.driver_id
  WHERE auth.uid() IS NOT NULL AND d.status = 'approved' AND d.online
    AND l.updated_at > now() - interval '3 minutes'
    AND 111.0 * sqrt(power(l.lat - _lat, 2) + power((l.lng - _lng) * cos(radians(_lat)), 2)) <= least(_radius_km, 20)
  LIMIT 40
$$;
REVOKE ALL ON FUNCTION public.nearby_drivers(double precision, double precision, double precision) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.nearby_drivers(double precision, double precision, double precision) TO authenticated;

CREATE OR REPLACE FUNCTION public.ride_fare_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f public.fare_settings;
BEGIN
  IF NEW.distance_km IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO f FROM public.fare_settings WHERE vehicle = NEW.vehicle;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fares for this vehicle are not set yet'; END IF;
  NEW.fare := greatest(f.min_fare, round((f.base_fare + f.per_km * NEW.distance_km + f.per_min * coalesce(NEW.duration_min,0)) / 10.0) * 10)::int;
  RETURN NEW;
END $$;
CREATE TRIGGER ride_fare_before_insert BEFORE INSERT ON public.ride_requests
  FOR EACH ROW EXECUTE FUNCTION public.ride_fare_before_insert();

CREATE OR REPLACE FUNCTION public.pool_seat_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.pool_routes;
BEGIN
  SELECT * INTO r FROM public.pool_routes WHERE id = NEW.pool_route_id FOR UPDATE;
  IF r.status NOT IN ('open','almost_full') THEN RAISE EXCEPTION 'This route is not accepting requests'; END IF;
  IF NEW.seats_requested < 1 OR NEW.seats_requested > r.available_seats THEN RAISE EXCEPTION 'Not enough seats available'; END IF;
  IF EXISTS (SELECT 1 FROM public.pool_seat_requests WHERE pool_route_id = NEW.pool_route_id AND rider_id = NEW.rider_id AND request_status IN ('pending','accepted')) THEN
    RAISE EXCEPTION 'You already have a request on this route';
  END IF;
  NEW.fare := r.price_per_seat * NEW.seats_requested;
  NEW.request_status := 'pending';
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_pool_seat_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.pool_routes; is_drv boolean; taken int;
BEGIN
  NEW.updated_at := now();
  IF NEW.request_status = 'accepted' AND OLD.request_status <> 'accepted' THEN
    SELECT * INTO r FROM public.pool_routes WHERE id = OLD.pool_route_id FOR UPDATE;
    SELECT coalesce(sum(seats_requested),0) INTO taken FROM public.pool_seat_requests
      WHERE pool_route_id = OLD.pool_route_id AND request_status IN ('accepted','completed') AND id <> OLD.id;
    IF taken + OLD.seats_requested > r.total_seats THEN RAISE EXCEPTION 'Not enough seats left'; END IF;
  END IF;
  IF pg_trigger_depth() > 1 OR public.has_role(auth.uid(),'admin') OR auth.uid() IS NULL THEN RETURN NEW; END IF;
  NEW.pool_route_id := OLD.pool_route_id; NEW.rider_id := OLD.rider_id; NEW.fare := OLD.fare;
  NEW.trip_pin := OLD.trip_pin; NEW.seats_requested := OLD.seats_requested;
  IF NEW.request_status = OLD.request_status THEN RETURN NEW; END IF;
  IF r.id IS NULL THEN SELECT * INTO r FROM public.pool_routes WHERE id = OLD.pool_route_id; END IF;
  is_drv := r.driver_id = auth.uid();
  IF is_drv THEN
    IF OLD.request_status = 'pending' AND NEW.request_status IN ('accepted','declined') THEN RETURN NEW; END IF;
    IF OLD.request_status = 'accepted' AND NEW.request_status IN ('completed','cancelled') THEN RETURN NEW; END IF;
  ELSIF OLD.rider_id = auth.uid() THEN
    IF OLD.request_status IN ('pending','accepted') AND NEW.request_status = 'cancelled' THEN RETURN NEW; END IF;
  END IF;
  RAISE EXCEPTION 'Status change not allowed';
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_requests;