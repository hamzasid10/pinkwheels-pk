CREATE OR REPLACE FUNCTION public.start_assigned_ride(_ride uuid,_pin text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.ride_requests;
BEGIN
 SELECT * INTO r FROM public.ride_requests WHERE id=_ride AND driver_id=auth.uid() FOR UPDATE;
 IF NOT FOUND OR r.status NOT IN ('driver_arriving','arrived') THEN RAISE EXCEPTION 'Ride is not ready to start'; END IF;
 IF _pin IS DISTINCT FROM r.trip_pin THEN RAISE EXCEPTION 'Incorrect Trip PIN'; END IF;
 UPDATE public.ride_requests SET status='in_progress' WHERE id=r.id;
END $$;
REVOKE ALL ON FUNCTION public.start_assigned_ride(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.start_assigned_ride(uuid,text) TO authenticated;