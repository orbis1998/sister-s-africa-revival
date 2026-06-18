-- Must run in its own transaction before any SQL that references the 'pos' role.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'pos';
