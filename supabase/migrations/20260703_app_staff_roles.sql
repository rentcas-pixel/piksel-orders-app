-- Vidinės komandos rolės: admin (viskas) | staff (užsakymai + išrašytos sąskaitos)

CREATE TABLE IF NOT EXISTS app_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'staff')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_users_role ON app_users (role);

ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'app_users' AND policyname = 'app_users_select_own'
  ) THEN
    CREATE POLICY app_users_select_own ON app_users
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION app_is_staff_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM app_users WHERE user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION app_has_finance_access()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM app_users WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION app_can_manage_issued_invoices()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT app_is_staff_or_admin();
$$;

-- Išrašytos sąskaitos — staff + admin
DO $$
DECLARE
  tbl TEXT;
  pol TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['invoices', 'invoice_lines', 'billing_companies']
  LOOP
    pol := 'Allow all on ' || tbl;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = tbl AND policyname = pol) THEN
      EXECUTE format('DROP POLICY %I ON %I', pol, tbl);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = tbl AND policyname = 'finance_admin_only') THEN
      EXECUTE format('DROP POLICY finance_admin_only ON %I', tbl);
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = tbl AND policyname = 'issued_invoices_staff_or_admin'
    ) THEN
      EXECUTE format(
        'CREATE POLICY issued_invoices_staff_or_admin ON %I FOR ALL USING (app_can_manage_issued_invoices()) WITH CHECK (app_can_manage_issued_invoices())',
        tbl
      );
    END IF;
  END LOOP;
END $$;

-- Bankas, gautos sąskaitos, paštas — tik admin
DO $$
DECLARE
  tbl TEXT;
  pol TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'received_invoices',
    'bank_transactions',
    'payment_allocations',
    'bank_settings',
    'processed_emails',
    'email_sync_state',
    'email_writing_style'
  ]
  LOOP
    pol := 'Allow all on ' || tbl;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = tbl AND policyname = pol) THEN
      EXECUTE format('DROP POLICY %I ON %I', pol, tbl);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = tbl AND policyname = 'issued_invoices_staff_or_admin') THEN
      EXECUTE format('DROP POLICY issued_invoices_staff_or_admin ON %I', tbl);
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = tbl AND policyname = 'finance_admin_only'
    ) THEN
      EXECUTE format(
        'CREATE POLICY finance_admin_only ON %I FOR ALL USING (app_has_finance_access()) WITH CHECK (app_has_finance_access())',
        tbl
      );
    END IF;
  END LOOP;
END $$;
