-- 012: Halbe Urlaubstage + Sperrtage (blocked days)

ALTER TABLE public.absences
  ALTER COLUMN days TYPE numeric(4,1) USING days::numeric;

ALTER TABLE public.absences
  ADD COLUMN IF NOT EXISTS day_part text NOT NULL DEFAULT 'full'
  CHECK (day_part IN ('full','half_am','half_pm'));

CREATE TABLE IF NOT EXISTS public.blocked_days (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL,
  reason text,
  category text DEFAULT NULL,
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS blocked_days_date_idx ON public.blocked_days(date);

ALTER TABLE public.blocked_days ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view blocked days" ON public.blocked_days;
CREATE POLICY "Users can view blocked days"
  ON public.blocked_days FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage blocked days" ON public.blocked_days;
CREATE POLICY "Admins can manage blocked days"
  ON public.blocked_days FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.email = current_setting('request.jwt.claims', true)::json->>'email'
        AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.email = current_setting('request.jwt.claims', true)::json->>'email'
        AND users.role = 'admin'
    )
  );
