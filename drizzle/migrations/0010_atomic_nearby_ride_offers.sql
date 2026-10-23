ALTER TABLE public.drivers ADD COLUMN current_mode text NOT NULL DEFAULT 'passenger' CHECK (current_mode IN ('passenger','driver'));
ALTER TABLE public.app_settings ADD COLUMN dispatch_radius_km numeric NOT NULL DEFAULT 10 CHECK (dispatch_radius_km > 0 AND dispatch_radius_km <= 50);
ALTER TABLE public.ride_requests ADD COLUMN driver_rating numeric;
ALTER TABLE public.ride_requests ADD COLUMN driver_photo_url text;
ALTER TABLE public.ride_requests ADD COLUMN driver_plate text;
CREATE TABLE public.ride_offers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ride_request_id uuid NOT NULL REFERENCES public.ride_requests(id), driver_id uuid NOT NULL REFERENCES public.drivers(user_id), status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined','expired')), offered_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '20 seconds', responded_at timestamptz, pickup_distance_km numeric NOT NULL, UNIQUE(ride_request_id,driver_id)
);
GRANT SELECT ON public.ride_offers TO authenticated;
GRANT ALL ON public.ride_offers TO service_role;
ALTER TABLE public.ride_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY offers_read ON public.ride_offers FOR SELECT TO authenticated USING(driver_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE INDEX ride_offers_pending ON public.ride_offers(driver_id,status,expires_at);
CREATE INDEX dispatch_waiting ON public.ride_requests(status,created_at);
ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_offers;
CREATE OR REPLACE FUNCTION public.guard_ride_update() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE target public.ride_status := new.status;
BEGIN
 IF current_user NOT IN ('authenticated','anon') OR public.has_role(auth.uid(),'admin') THEN new.updated_at:=now(); RETURN new; END IF;
 new:=old; new.status:=target; new.updated_at:=now();
 IF auth.uid()=old.driver_id THEN
  IF NOT (target=old.status OR (old.status IN ('driver_assigned','accepted') AND target='driver_arriving') OR (old.status='driver_arriving' AND target IN ('arrived','ride_started')) OR (old.status='arrived' AND target IN ('ride_started','in_progress')) OR (old.status IN ('ride_started','in_progress') AND target='completed')) THEN RAISE EXCEPTION 'Invalid status change'; END IF;
 ELSIF auth.uid()=old.rider_id THEN
  IF target<>old.status AND NOT (target='cancelled' AND old.status IN ('requested','searching','offered','driver_assigned','accepted','driver_arriving','arrived')) THEN RAISE EXCEPTION 'Riders can only cancel'; END IF;
 ELSE RAISE EXCEPTION 'Forbidden'; END IF;
 RETURN new;
END $$;
CREATE OR REPLACE FUNCTION public.dispatch_ride_internal(_ride uuid) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.ride_requests; radius numeric; n integer;
BEGIN
 SELECT * INTO r FROM public.ride_requests WHERE id=_ride FOR UPDATE;
 IF NOT FOUND OR r.status NOT IN ('requested','searching','offered') THEN RETURN 0; END IF;
 UPDATE public.ride_offers SET status='expired',responded_at=now() WHERE ride_request_id=r.id AND status='pending' AND expires_at<=now();
 IF r.created_at < now()-interval '5 minutes' THEN
  UPDATE public.ride_requests SET status='expired' WHERE id=r.id;
  UPDATE public.ride_offers SET status='expired',responded_at=now() WHERE ride_request_id=r.id AND status='pending'; RETURN 0;
 END IF;
 SELECT dispatch_radius_km INTO radius FROM public.app_settings LIMIT 1; radius:=coalesce(radius,10);
 INSERT INTO public.ride_offers(ride_request_id,driver_id,pickup_distance_km)
 SELECT r.id,d.user_id,round(x.km::numeric,2) FROM public.drivers d
 JOIN public.profiles p ON p.id=d.user_id JOIN public.driver_locations l ON l.driver_id=d.user_id
 CROSS JOIN LATERAL (SELECT 6371*2*asin(sqrt(least(1.0,power(sin(radians(l.lat-r.pickup_lat)/2),2)+cos(radians(r.pickup_lat))*cos(radians(l.lat))*power(sin(radians(l.lng-r.pickup_lng)/2),2)))) km) x
 WHERE d.user_id<>r.rider_id AND d.status='approved' AND d.online AND d.current_mode='driver' AND p.location_sharing AND NOT p.suspended
 AND (d.licence_expiry IS NULL OR d.licence_expiry>=current_date) AND l.updated_at>now()-interval '2 minutes' AND x.km<=radius
 AND EXISTS(SELECT 1 FROM public.vehicles v WHERE v.driver_id=d.user_id AND v.kind=r.vehicle AND length(trim(v.reg_no))>0)
 AND NOT EXISTS(SELECT 1 FROM public.ride_requests a WHERE a.driver_id=d.user_id AND a.status IN ('driver_assigned','accepted','driver_arriving','arrived','ride_started','in_progress'))
 AND NOT EXISTS(SELECT 1 FROM public.pool_routes pr WHERE pr.driver_id=d.user_id AND pr.status='started')
 ON CONFLICT(ride_request_id,driver_id) DO NOTHING;
 GET DIAGNOSTICS n=ROW_COUNT;
 UPDATE public.ride_requests SET status=CASE WHEN EXISTS(SELECT 1 FROM public.ride_offers o WHERE o.ride_request_id=r.id AND o.status='pending' AND o.expires_at>now()) THEN 'offered'::public.ride_status ELSE 'searching'::public.ride_status END WHERE id=r.id;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.dispatch_ride_internal(uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.ride_dispatch_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN PERFORM public.dispatch_ride_internal(new.id); RETURN new; END $$;
REVOKE ALL ON FUNCTION public.ride_dispatch_insert() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER dispatch_new_ride AFTER INSERT ON public.ride_requests FOR EACH ROW EXECUTE FUNCTION public.ride_dispatch_insert();
CREATE OR REPLACE FUNCTION public.dispatch_tick(_ride uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 FOR r IN SELECT id FROM public.ride_requests WHERE status IN ('requested','searching','offered') AND ((_ride IS NOT NULL AND id=_ride AND rider_id=auth.uid()) OR (_ride IS NULL AND EXISTS(SELECT 1 FROM public.drivers d WHERE d.user_id=auth.uid() AND d.status='approved' AND d.online AND d.current_mode='driver'))) LOOP PERFORM public.dispatch_ride_internal(r.id); END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.dispatch_tick(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.dispatch_tick(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.respond_ride_offer(_offer uuid,_accept boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.ride_offers; r public.ride_requests; d public.drivers; v public.vehicles;
BEGIN
 SELECT * INTO o FROM public.ride_offers WHERE id=_offer AND driver_id=auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'Offer unavailable'; END IF;
 SELECT * INTO r FROM public.ride_requests WHERE id=o.ride_request_id FOR UPDATE;
 SELECT * INTO d FROM public.drivers WHERE user_id=auth.uid() FOR UPDATE;
 SELECT * INTO o FROM public.ride_offers WHERE id=_offer FOR UPDATE;
 IF o.status<>'pending' OR o.expires_at<=now() OR r.status NOT IN ('requested','searching','offered') THEN RAISE EXCEPTION 'Offer expired or already taken'; END IF;
 IF NOT _accept THEN UPDATE public.ride_offers SET status='declined',responded_at=now() WHERE id=o.id; PERFORM public.dispatch_ride_internal(r.id); RETURN r.id; END IF;
 IF d.status<>'approved' OR NOT d.online OR d.current_mode<>'driver' OR EXISTS(SELECT 1 FROM public.profiles WHERE id=d.user_id AND (suspended OR NOT location_sharing)) OR (d.licence_expiry IS NOT NULL AND d.licence_expiry<current_date) THEN RAISE EXCEPTION 'Driver is not eligible'; END IF;
 IF EXISTS(SELECT 1 FROM public.ride_requests WHERE driver_id=d.user_id AND status IN ('driver_assigned','accepted','driver_arriving','arrived','ride_started','in_progress')) OR EXISTS(SELECT 1 FROM public.pool_routes WHERE driver_id=d.user_id AND status='started') THEN RAISE EXCEPTION 'Finish your active trip first'; END IF;
 SELECT * INTO v FROM public.vehicles WHERE driver_id=d.user_id AND kind=r.vehicle AND length(trim(reg_no))>0 LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION 'Matching vehicle required'; END IF;
 UPDATE public.ride_offers SET status='accepted',responded_at=now() WHERE id=o.id;
 UPDATE public.ride_requests SET status='accepted',driver_id=d.user_id,driver_name=split_part(d.full_name,' ',1),driver_phone=d.phone,driver_vehicle=v.make_model,driver_plate=v.reg_no,driver_rating=CASE WHEN EXISTS(SELECT 1 FROM public.ratings WHERE driver_id=d.user_id) OR EXISTS(SELECT 1 FROM public.pool_ratings WHERE driver_id=d.user_id) THEN d.rating ELSE NULL END WHERE id=r.id;
 UPDATE public.ride_offers SET status='expired',responded_at=now() WHERE status='pending' AND (ride_request_id=r.id OR driver_id=d.user_id);
 RETURN r.id;
END $$;
REVOKE ALL ON FUNCTION public.respond_ride_offer(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.respond_ride_offer(uuid,boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.driver_mode_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF new.current_mode='driver' AND (new.status<>'approved' OR EXISTS(SELECT 1 FROM public.profiles WHERE id=new.user_id AND suspended)) THEN RAISE EXCEPTION 'Approved driver required'; END IF;
 IF new.current_mode='passenger' THEN
  IF EXISTS(SELECT 1 FROM public.ride_requests WHERE driver_id=new.user_id AND status IN ('accepted','driver_arriving','arrived','ride_started','in_progress')) OR EXISTS(SELECT 1 FROM public.pool_routes WHERE driver_id=new.user_id AND status='started') THEN RAISE EXCEPTION 'Complete your current trip before switching modes'; END IF;
  new.online:=false;
 END IF; RETURN new;
END $$;
REVOKE ALL ON FUNCTION public.driver_mode_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER z_driver_mode_guard BEFORE UPDATE ON public.drivers FOR EACH ROW EXECUTE FUNCTION public.driver_mode_guard();
CREATE OR REPLACE FUNCTION public.ride_offer_cleanup() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF new.status IN ('cancelled','completed','expired') THEN UPDATE public.ride_offers SET status='expired',responded_at=now() WHERE ride_request_id=new.id AND status='pending'; END IF; RETURN new;
END $$;
REVOKE ALL ON FUNCTION public.ride_offer_cleanup() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER cleanup_ride_offers AFTER UPDATE OF status ON public.ride_requests FOR EACH ROW EXECUTE FUNCTION public.ride_offer_cleanup();
CREATE OR REPLACE FUNCTION public.rider_can_track(_driver uuid,_rider uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.ride_requests WHERE driver_id=_driver AND rider_id=_rider AND status IN ('driver_assigned','accepted','driver_arriving','arrived','ride_started','in_progress')) $$;
CREATE OR REPLACE FUNCTION public.incoming_ride_offers() RETURNS TABLE(id uuid,ride_request_id uuid,expires_at timestamptz,pickup text,destination text,pickup_distance_km numeric,distance_km numeric,duration_min numeric,fare integer,vehicle public.vehicle_kind) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT o.id,r.id,o.expires_at,r.pickup,r.destination,o.pickup_distance_km,r.distance_km,r.duration_min,r.fare,r.vehicle FROM public.ride_offers o JOIN public.ride_requests r ON r.id=o.ride_request_id JOIN public.drivers d ON d.user_id=o.driver_id WHERE o.driver_id=auth.uid() AND o.status='pending' AND o.expires_at>now() AND r.status IN ('requested','searching','offered') AND d.status='approved' AND d.online AND d.current_mode='driver' ORDER BY o.offered_at $$;
REVOKE ALL ON FUNCTION public.incoming_ride_offers() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.incoming_ride_offers() TO authenticated;
ALTER PUBLICATION supabase_realtime ADD TABLE public.drivers;