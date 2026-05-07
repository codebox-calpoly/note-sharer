-- Create an active enrollment cycle if one doesn't exist
INSERT INTO public.enrollment_cycles (name, catalog_term, is_active)
SELECT 'Current enrollment', null, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.enrollment_cycles WHERE is_active = true
);
