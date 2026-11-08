-- 002: role chỉ đọc cho ứng dụng. KHÔNG đặt mật khẩu ở đây.
-- Sau khi áp dụng, tự đặt mật khẩu trong Supabase SQL Editor:
--   ALTER ROLE app_readonly PASSWORD '<chuỗi mạnh của bạn>';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_readonly') THEN
    CREATE ROLE app_readonly LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
END $$;

ALTER ROLE app_readonly CONNECTION LIMIT 10;
ALTER ROLE app_readonly SET statement_timeout = '5s';
ALTER ROLE app_readonly SET default_transaction_read_only = on;
ALTER ROLE app_readonly SET search_path = analytics;

REVOKE ALL ON SCHEMA public FROM app_readonly;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM app_readonly;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM app_readonly;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM app_readonly;

GRANT USAGE ON SCHEMA analytics TO app_readonly;
GRANT SELECT ON analytics.sales_clean TO app_readonly;
