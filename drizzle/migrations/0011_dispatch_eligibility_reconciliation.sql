CREATE OR REPLACE FUNCTION public.driver_mode_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF new.status<>'approved' OR EXISTS(SELECT 1 FROM public.profiles WHERE id=new.user_id AND suspended) THEN new.current_mode:='passenger'; new.online:=false; RETURN new; END IF;
 IF new.current_mode='passenger' THEN
  IF EXISTS(SELECT 1 FROM public.ride_requests WHERE driver_id=new.user_id AND status IN ('driver_assigned','accepted','driver_arriving','arrived','ride_started','in_progress')) OR EXISTS(SELECT 1 FROM public.pool_routes WHERE driver_id=new.user_id AND status='started') THEN RAISE EXCEPTION 'Complete your current trip before switching modes'; END IF;
  new.online:=false;
 END IF; RETURN new;
END $$;
CREATE OR REPLACE FUNCTION public.dispatch_available_driver() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record; who uuid;
BEGIN
 IF TG_TABLE_NAME='drivers' THEN who:=new.user_id; ELSE who:=new.driver_id; END IF;
 IF EXISTS(SELECT 1 FROM public.drivers WHERE user_id=who AND status='approved' AND online AND current_mode='driver') THEN
  FOR r IN SELECT id FROM public.ride_requests WHERE status IN ('requested','searching','offered') AND created_at>now()-interval '5 minutes' LOOP PERFORM public.dispatch_ride_internal(r.id); END LOOP;
 END IF; RETURN new;
END $$;
REVOKE ALL ON FUNCTION public.dispatch_available_driver() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER dispatch_on_location AFTER INSERT OR UPDATE ON public.driver_locations FOR EACH ROW EXECUTE FUNCTION public.dispatch_available_driver();
CREATE TRIGGER dispatch_on_availability AFTER UPDATE OF online,current_mode ON public.drivers FOR EACH ROW EXECUTE FUNCTION public.dispatch_available_driver();
CREATE OR REPLACE FUNCTION public.nearby_drivers(_lat double precision,_lng double precision,_radius_km double precision DEFAULT 8) RETURNS TABLE(lat double precision,lng double precision,vehicle public.vehicle_kind) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT round(l.lat::numeric*300)::double precision/300,round(l.lng::numeric*300)::double precision/300,v.kind
 FROM public.driver_locations l JOIN public.drivers d ON d.user_id=l.driver_id JOIN public.profiles p ON p.id=d.user_id JOIN LATERAL (SELECT kind FROM public.vehicles WHERE driver_id=d.user_id AND length(trim(reg_no))>0 ORDER BY created_at LIMIT 1) v ON true
 WHERE auth.uid() IS NOT NULL AND d.user_id<>auth.uid() AND d.status='approved' AND d.online AND d.current_mode='driver' AND p.location_sharing AND NOT p.suspended AND (d.licence_expiry IS NULL OR d.licence_expiry>=current_date) AND l.updated_at>now()-interval '2 minutes'
 AND NOT EXISTS(SELECT 1 FROM public.ride_requests r WHERE r.driver_id=d.user_id AND r.status IN ('driver_assigned','accepted','driver_arriving','arrived','ride_started','in_progress'))
 AND NOT EXISTS(SELECT 1 FROM public.pool_routes pr WHERE pr.driver_id=d.user_id AND pr.status='started')
 AND 6371*2*asin(sqrt(least(1.0,power(sin(radians(l.lat-_lat)/2),2)+cos(radians(_lat))*cos(radians(l.lat))*power(sin(radians(l.lng-_lng)/2),2)))) <= least(_radius_km,coalesce((SELECT dispatch_radius_km FROM public.app_settings LIMIT 1),10)) LIMIT 40
$$;