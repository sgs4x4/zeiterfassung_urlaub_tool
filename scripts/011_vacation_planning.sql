-- Add category field to users table (Vertrieb, Werkstatt, Lager)
ALTER TABLE users ADD COLUMN IF NOT EXISTS category text DEFAULT NULL;

-- Add is_reporter role support via role column (already exists, just document values)
-- role: 'admin' | 'reporter' | null (= regular user)

-- Create blocked_days table for admin-blocked dates
CREATE TABLE IF NOT EXISTS blocked_days (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL,
  reason text,
  category text DEFAULT NULL, -- NULL = all categories, or specific category
  created_by uuid REFERENCES users(id),
  created_at timestamp with time zone DEFAULT now()
);

-- Add email notification tracking to absences
ALTER TABLE absences ADD COLUMN IF NOT EXISTS notification_sent boolean DEFAULT false;

-- Index for blocked_days lookups
CREATE INDEX IF NOT EXISTS blocked_days_date_idx ON blocked_days(date);
