-- Migration: Clean up old user categories that are no longer supported
-- Changes "buero" and "sonstiges" categories to NULL
-- Keeps only: vertrieb, werkstatt, lager

BEGIN;

UPDATE users
SET category = NULL
WHERE category IN ('buero', 'sonstiges');

COMMIT;
