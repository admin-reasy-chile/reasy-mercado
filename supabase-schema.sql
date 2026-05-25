-- ============================================================
-- REASY — Schema Supabase
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Tabla principal de licitaciones
CREATE TABLE IF NOT EXISTS licitaciones (
  id              BIGSERIAL PRIMARY KEY,
  codigo          TEXT UNIQUE NOT NULL,
  nombre          TEXT,
  organismo       TEXT,
  region          TEXT,
  tipo            TEXT,
  estado          TEXT,        -- publicada | cerrada | adjudicada
  keyword_match   TEXT,
  fecha_pub       DATE,
  fecha_cierre    DATE,
  fecha_adj       DATE,
  dias_restantes  INTEGER,
  semaforo        TEXT,        -- urgente | proximo | con_tiempo | cerrada | sin_fecha
  monto_estimado  BIGINT,
  url             TEXT,
  descripcion     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Seguimiento CRM por licitación (1:1)
CREATE TABLE IF NOT EXISTS seguimiento (
  id                BIGSERIAL PRIMARY KEY,
  licitacion_codigo TEXT UNIQUE REFERENCES licitaciones(codigo) ON DELETE CASCADE,
  estado_crm        TEXT DEFAULT 'nueva',  -- nueva | en_analisis | postulada | ganada | descartada
  notas             TEXT,
  usuario           TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Log de ejecuciones del sync
CREATE TABLE IF NOT EXISTS sync_log (
  id          BIGSERIAL PRIMARY KEY,
  total       INTEGER,
  nuevas      INTEGER,
  actualizadas INTEGER,
  modo        TEXT,  -- api | demo
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para las queries más frecuentes
CREATE INDEX IF NOT EXISTS idx_licitaciones_estado    ON licitaciones(estado);
CREATE INDEX IF NOT EXISTS idx_licitaciones_semaforo  ON licitaciones(semaforo);
CREATE INDEX IF NOT EXISTS idx_licitaciones_region    ON licitaciones(region);
CREATE INDEX IF NOT EXISTS idx_licitaciones_cierre    ON licitaciones(fecha_cierre);

-- Row Level Security: solo el service role puede escribir,
-- el anon key solo puede leer (el frontend autentica via cookie propia)
ALTER TABLE licitaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE seguimiento  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_log     ENABLE ROW LEVEL SECURITY;

-- Service role tiene acceso total (bypass RLS)
-- Anon key: sin políticas = sin acceso (correcto, el frontend usa el service key via API routes)
