CREATE OR REPLACE FUNCTION public.guard_pool_seat_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.pool_routes; is_drv boolean;
BEGIN
  NEW.updated_at := now();
  IF pg_trigger_depth() > 1 OR public.has_role(auth.uid(),'admin') OR auth.uid() IS NULL THEN RETURN NEW; END IF;
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