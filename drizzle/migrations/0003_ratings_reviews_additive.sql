CREATE TABLE public.pool_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_seat_id uuid NOT NULL UNIQUE REFERENCES public.pool_seat_requests(id) ON DELETE CASCADE,
  rater_id uuid NOT NULL,
  driver_id uuid,
  stars integer NOT NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.pool_ratings TO authenticated;
GRANT ALL ON public.pool_ratings TO service_role;
ALTER TABLE public.pool_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pool rating read" ON public.pool_ratings FOR SELECT TO authenticated
  USING (rater_id = auth.uid() OR driver_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "pool rating insert" ON public.pool_ratings FOR INSERT TO authenticated
  WITH CHECK (rater_id = auth.uid());

CREATE UNIQUE INDEX IF NOT EXISTS ratings_one_per_ride ON public.ratings(ride_id);

CREATE OR REPLACE FUNCTION public.validate_rating()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d uuid;
BEGIN
  IF NEW.stars < 1 OR NEW.stars > 5 THEN RAISE EXCEPTION 'Stars must be 1-5'; END IF;
  IF NEW.comment IS NOT NULL THEN NEW.comment := left(trim(NEW.comment), 500); END IF;
  IF TG_TABLE_NAME = 'ratings' THEN
    SELECT driver_id INTO d FROM public.ride_requests
      WHERE id = NEW.ride_id AND rider_id = auth.uid() AND status = 'completed';
  ELSE
    SELECT r.driver_id INTO d FROM public.pool_seat_requests s JOIN public.pool_routes r ON r.id = s.pool_route_id
      WHERE s.id = NEW.pool_seat_id AND s.rider_id = auth.uid() AND s.request_status = 'completed';
  END IF;
  IF d IS NULL THEN RAISE EXCEPTION 'You can only rate your own completed trips'; END IF;
  NEW.driver_id := d;
  NEW.rater_id := auth.uid();
  RETURN NEW;
END $$;
CREATE TRIGGER validate_rating BEFORE INSERT ON public.ratings FOR EACH ROW EXECUTE FUNCTION public.validate_rating();
CREATE TRIGGER validate_pool_rating BEFORE INSERT ON public.pool_ratings FOR EACH ROW EXECUTE FUNCTION public.validate_rating();

CREATE OR REPLACE FUNCTION public.refresh_driver_rating()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE avg_r numeric;
BEGIN
  SELECT round(avg(stars)::numeric, 1) INTO avg_r FROM (
    SELECT stars FROM public.ratings WHERE driver_id = NEW.driver_id
    UNION ALL SELECT stars FROM public.pool_ratings WHERE driver_id = NEW.driver_id) x;
  UPDATE public.drivers SET rating = avg_r WHERE user_id = NEW.driver_id;
  UPDATE public.pool_routes SET driver_rating = avg_r WHERE driver_id = NEW.driver_id AND status IN ('open','almost_full','full','started');
  RETURN NEW;
END $$;
CREATE TRIGGER refresh_driver_rating AFTER INSERT ON public.ratings FOR EACH ROW EXECUTE FUNCTION public.refresh_driver_rating();
CREATE TRIGGER refresh_pool_driver_rating AFTER INSERT ON public.pool_ratings FOR EACH ROW EXECUTE FUNCTION public.refresh_driver_rating();

CREATE OR REPLACE FUNCTION public.guard_driver_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if pg_trigger_depth() > 1 then return new; end if;
  if not public.has_role(auth.uid(),'admin') then
    new.status := old.status;
    new.rating := old.rating;
  end if;
  return new;
end $$;