DROP POLICY "settings read" ON public.app_settings;
CREATE POLICY "settings read" ON public.app_settings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'driver'));