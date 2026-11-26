-- ============================================================================
-- SMARTLISTRIK — SKEMA DATABASE TERPADU (POSTGRESQL / SUPABASE)
-- ============================================================================

-- 1. EKSTENSI
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. TABEL UTAMA
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  nama text,
  tarif_per_kwh numeric NOT NULL DEFAULT 1444.70,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id)
    REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.devices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  claim_code text UNIQUE,
  nama text NOT NULL,
  jenis_beban text NOT NULL DEFAULT 'Kipas Angin',
  lokasi text,
  daya_nominal_w integer NOT NULL DEFAULT 50,
  ingest_key_hash text NOT NULL,
  last_seen_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT devices_pkey PRIMARY KEY (id),
  CONSTRAINT devices_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.readings (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  device_id uuid NOT NULL,
  ts timestamp with time zone NOT NULL,
  v numeric NOT NULL,
  i numeric NOT NULL,
  p numeric NOT NULL,
  e_wh numeric NOT NULL,
  CONSTRAINT readings_pkey PRIMARY KEY (id),
  CONSTRAINT readings_device_id_fkey FOREIGN KEY (device_id)
    REFERENCES public.devices(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.user_thresholds (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_id uuid,
  tipe text NOT NULL CHECK (tipe = ANY (ARRAY['durasi_lama'::text, 'estimasi_biaya'::text])),
  ambang numeric NOT NULL,
  aktif boolean NOT NULL DEFAULT true,
  CONSTRAINT user_thresholds_pkey PRIMARY KEY (id),
  CONSTRAINT user_thresholds_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT user_thresholds_device_id_fkey FOREIGN KEY (device_id)
    REFERENCES public.devices(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_id uuid,
  tipe text NOT NULL,
  judul text NOT NULL,
  isi text NOT NULL,
  link text NOT NULL DEFAULT '/cek'::text,
  dibaca boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT notifications_device_id_fkey FOREIGN KEY (device_id)
    REFERENCES public.devices(id) ON DELETE SET NULL
);

-- 3. INDEX PERFORMA
CREATE INDEX IF NOT EXISTS idx_readings_device_ts
  ON public.readings (device_id, ts DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

-- 4. TRIGGER OTOMATIS SAAT USER BARU MENDAFTAR
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nama)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'nama', ''),
      NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
      'Pengguna'
    )
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_thresholds (user_id, tipe, ambang)
  VALUES
    (NEW.id, 'durasi_lama', 8),
    (NEW.id, 'estimasi_biaya', 50000);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 5. SINKRONISASI AKUN LAMA (JIKA ADA USER YANG SUDAH TERDAFTAR SEBELUMNYA)
INSERT INTO public.profiles AS p (id, nama)
SELECT
  id,
  COALESCE(
    NULLIF(raw_user_meta_data->>'nama', ''),
    NULLIF(raw_user_meta_data->>'full_name', ''),
    'Pengguna'
  )
FROM auth.users
ON CONFLICT (id) DO UPDATE
  SET nama = COALESCE(NULLIF(p.nama, ''), EXCLUDED.nama);

INSERT INTO public.user_thresholds (user_id, tipe, ambang)
SELECT p.id, 'durasi_lama', 8
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_thresholds ut
  WHERE ut.user_id = p.id AND ut.tipe = 'durasi_lama' AND ut.device_id IS NULL
);

INSERT INTO public.user_thresholds (user_id, tipe, ambang)
SELECT p.id, 'estimasi_biaya', 50000
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_thresholds ut
  WHERE ut.user_id = p.id AND ut.tipe = 'estimasi_biaya' AND ut.device_id IS NULL
);

-- 6. ROW LEVEL SECURITY (RLS) & POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policies: profiles
DROP POLICY IF EXISTS "profiles_own_policy" ON public.profiles;
CREATE POLICY "profiles_own_policy"
  ON public.profiles FOR ALL TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Policies: devices (mendukung Scan QR belum diklaim, Klaim, Edit, & Unbind)
DROP POLICY IF EXISTS "devices_select_policy" ON public.devices;
CREATE POLICY "devices_select_policy"
  ON public.devices FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS "devices_insert_policy" ON public.devices;
CREATE POLICY "devices_insert_policy"
  ON public.devices FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "devices_update_policy" ON public.devices;
CREATE POLICY "devices_update_policy"
  ON public.devices FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL)
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS "devices_delete_policy" ON public.devices;
CREATE POLICY "devices_delete_policy"
  ON public.devices FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Policies: readings (user hanya membaca data milik perangkat miliknya)
DROP POLICY IF EXISTS "readings_select_own_devices" ON public.readings;
CREATE POLICY "readings_select_own_devices"
  ON public.readings FOR SELECT TO authenticated
  USING (
    device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid())
  );

-- Policies: user_thresholds
DROP POLICY IF EXISTS "user_thresholds_own_policy" ON public.user_thresholds;
CREATE POLICY "user_thresholds_own_policy"
  ON public.user_thresholds FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policies: notifications
DROP POLICY IF EXISTS "notifications_own_policy" ON public.notifications;
CREATE POLICY "notifications_own_policy"
  ON public.notifications FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 7. SEED UNIT HARDWARE PABRIK (PRE-PROVISIONED QR CLAIM)
WITH factory_units (claim_code, raw_api_key, default_nama, default_jenis, default_daya) AS (
  VALUES
    ('STL-1001', 'stl_esp32_unit01_rahasia991', 'Colokan Pintar 01', 'Kipas Angin', 50),
    ('STL-1002', 'stl_esp32_unit02_rahasia992', 'Colokan Pintar 02', 'Lampu Meja', 60),
    ('STL-1003', 'stl_esp32_unit03_rahasia993', 'Colokan Pintar 03', 'Teko Listrik', 500)
),
inserted AS (
  INSERT INTO public.devices (
    user_id,
    claim_code,
    nama,
    jenis_beban,
    daya_nominal_w,
    ingest_key_hash
  )
  SELECT
    NULL,
    f.claim_code,
    f.default_nama,
    f.default_jenis,
    f.default_daya,
    encode(digest(f.raw_api_key, 'sha256'), 'hex')
  FROM factory_units f
  ON CONFLICT (claim_code) DO UPDATE
    SET ingest_key_hash = EXCLUDED.ingest_key_hash
  RETURNING id, claim_code
)
SELECT
  i.claim_code AS "Kode Stiker QR",
  i.id AS "DEVICE_ID (Tanam di ESP32)",
  f.raw_api_key AS "API_KEY (Tanam di ESP32)"
FROM inserted i
JOIN factory_units f ON i.claim_code = f.claim_code
ORDER BY i.claim_code;

-- 8. SEGARAKAN CACHE SCHEMA API SUPABASE
NOTIFY pgrst, 'reload schema';