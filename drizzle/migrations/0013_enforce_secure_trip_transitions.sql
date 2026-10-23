CREATE OR REPLACE FUNCTION public.guard_ride_update() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE target public.ride_status := new.status;
BEGIN
 IF current_user NOT IN ('authenticated','anon') OR public.has_role(auth.uid(),'admin') THEN new.updated_at:=now(); RETURN new; END IF;
 new:=old; new.status:=target; new.updated_at:=now();
 IF auth.uid()=old.driver_id THEN
  IF NOT (target=old.status OR (old.status IN ('driver_assigned','accepted') AND target='driver_arriving') OR (old.status='driver_arriving' AND target='arrived') OR (old.status IN ('ride_started','in_progress') AND target='completed')) THEN RAISE EXCEPTION 'Invalid status change; use the Trip PIN to start'; END IF;
 ELSIF auth.uid()=old.rider_id THEN
  IF target<>old.status AND NOT (target='cancelled' AND old.status IN ('requested','searching','offered','driver_assigned','accepted','driver_arriving','arrived')) THEN RAISE EXCEPTION 'Riders can only cancel'; END IF;
 ELSE RAISE EXCEPTION 'Forbidden'; END IF;
 RETURN new;
END $$;