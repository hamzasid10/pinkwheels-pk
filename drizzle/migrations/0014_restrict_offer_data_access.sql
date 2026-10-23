REVOKE ALL ON public.ride_offers FROM anon;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.ride_offers FROM authenticated;
GRANT SELECT ON public.ride_offers TO authenticated;
GRANT ALL ON public.ride_offers TO service_role;