"""
REASY — Sync de Licitaciones a Supabase
Basado en reasy_mercadopublico.py. Reemplaza salida Excel por inserción en BD.

Variables de entorno requeridas:
  MERCADO_PUBLICO_TICKET   — API key de Mercado Público
  SUPABASE_URL             — URL del proyecto Supabase
  SUPABASE_SERVICE_KEY     — Service role key (escribe en BD)

Modo demo activo automáticamente si no hay API ticket.
"""

import os
import sys
import datetime
import requests

# ─────────────────────────────────────────────
#  CONFIG
# ─────────────────────────────────────────────

API_TICKET    = os.environ.get("MERCADO_PUBLICO_TICKET", "")
SUPABASE_URL  = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY  = os.environ.get("SUPABASE_SERVICE_KEY", "")

BASE_URL = "https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json"

ALERTA_ROJA_DIAS     = 5
ALERTA_AMARILLA_DIAS = 15

PALABRAS_CLAVE = [
    "residuos hospitalarios",
    "residuos peligrosos",
    "REAS",
    "manejo de residuos",
    "gestión de residuos",
    "residuos biomedicos",
    "residuos biomédicos",
    "eliminacion de residuos",
    "eliminación de residuos",
    "tratamiento de residuos",
    "residuos sanitarios",
    "residuos clínicos",
    "residuos clinicos",
    "incineración de residuos",
    "transporte de residuos peligrosos",
    "residuos anatomopatológicos",
]

ESTADOS_BUSQUEDA = ["publicada", "cerrada", "adjudicada"]

# ─────────────────────────────────────────────
#  API MERCADO PÚBLICO
# ─────────────────────────────────────────────

def buscar_licitaciones(ticket: str, busqueda: str, estado: str) -> list:
    try:
        resp = requests.get(BASE_URL, params={"ticket": ticket, "q": busqueda, "estado": estado}, timeout=30)
        resp.raise_for_status()
        return resp.json().get("Listado", [])
    except Exception as e:
        print(f"  ⚠ Error ({estado}, '{busqueda}'): {e}")
        return []


def buscar_todas(ticket: str) -> list:
    import time
    encontradas = {}
    for estado in ESTADOS_BUSQUEDA:
        print(f"\n🔍 {estado.upper()}")
        for kw in PALABRAS_CLAVE:
            time.sleep(1.5)  # evitar rate limit 429
            resultados = buscar_licitaciones(ticket, kw, estado)
            for lic in resultados:
                codigo = lic.get("CodigoExterno", "")
                if codigo and codigo not in encontradas:
                    lic["_Estado"] = estado
                    lic["_KeywordMatch"] = kw
                    encontradas[codigo] = lic
            print(f"   '{kw}' → {len(resultados)} resultados")
    return list(encontradas.values())


# ─────────────────────────────────────────────
#  PROCESAMIENTO
# ─────────────────────────────────────────────

def parsear_fecha(s: str):
    if not s:
        return None
    s = str(s).strip()
    for fmt, n in [("%d/%m/%Y %H:%M:%S", 19), ("%d/%m/%Y", 10), ("%Y-%m-%dT%H:%M:%S", 19), ("%Y-%m-%d", 10)]:
        try:
            return datetime.datetime.strptime(s[:n], fmt).date()
        except Exception:
            continue
    return None


def semaforo(dias) -> str:
    if dias is None:   return "sin_fecha"
    if dias < 0:       return "cerrada"
    if dias <= ALERTA_ROJA_DIAS:     return "urgente"
    if dias <= ALERTA_AMARILLA_DIAS: return "proximo"
    return "con_tiempo"


def procesar(raw_list: list) -> list:
    resultado = []
    hoy = datetime.date.today()

    for lic in raw_list:
        fecha_cierre_str = lic.get("FechaCierre") or lic.get("Cierre", {}).get("FechaTope", "")
        fecha_pub_str    = lic.get("FechaPublicacion", "")
        fecha_adj_str    = lic.get("FechaAdjudicacion", "")

        fecha_cierre = parsear_fecha(fecha_cierre_str)
        fecha_pub    = parsear_fecha(fecha_pub_str)
        fecha_adj    = parsear_fecha(fecha_adj_str)

        dias = (fecha_cierre - hoy).days if fecha_cierre else None

        try:
            monto = float(str(lic.get("MontoEstimado", "") or "").replace(".", "").replace(",", "."))
        except Exception:
            monto = None

        codigo = lic.get("CodigoExterno", "")

        resultado.append({
            "codigo":          codigo,
            "nombre":          lic.get("Nombre", ""),
            "organismo":       lic.get("NombreOrganismo", ""),
            "region":          lic.get("NombreRegion", ""),
            "tipo":            lic.get("Tipo", ""),
            "estado":          lic.get("_Estado", lic.get("CodigoEstado", "")),
            "keyword_match":   lic.get("_KeywordMatch", ""),
            "fecha_pub":       fecha_pub.isoformat() if fecha_pub else None,
            "fecha_cierre":    fecha_cierre.isoformat() if fecha_cierre else None,
            "fecha_adj":       fecha_adj.isoformat() if fecha_adj else None,
            "dias_restantes":  dias,
            "semaforo":        semaforo(dias),
            "monto_estimado":  int(monto) if monto else None,
            "descripcion":     lic.get("Descripcion", ""),
            "url":             f"https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?qs={codigo}",
            "updated_at":      datetime.datetime.utcnow().isoformat(),
        })

    return resultado


# ─────────────────────────────────────────────
#  SUPABASE
# ─────────────────────────────────────────────

def supabase_upsert(tabla: str, registros: list) -> dict:
    """Upsert en bloque a Supabase via REST API."""
    if not registros:
        return {"count": 0}

    url = f"{SUPABASE_URL}/rest/v1/{tabla}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }

    # Supabase tiene límite de ~1000 registros por request
    BATCH = 500
    total = 0
    for i in range(0, len(registros), BATCH):
        batch = registros[i:i + BATCH]
        resp = requests.post(url, headers=headers, json=batch, timeout=30)
        if not resp.ok:
            print(f"  ⚠ Supabase error {resp.status_code}: {resp.text[:200]}")
        else:
            total += len(batch)

    return {"count": total}


def supabase_log(total: int, nuevas: int, actualizadas: int):
    """Registra la ejecución en sync_log."""
    url = f"{SUPABASE_URL}/rest/v1/sync_log"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    payload = {
        "total": total,
        "nuevas": nuevas,
        "actualizadas": actualizadas,
        "modo": "api" if API_TICKET else "demo",
        "created_at": datetime.datetime.utcnow().isoformat(),
    }
    requests.post(url, headers=headers, json=payload, timeout=10)


# ─────────────────────────────────────────────
#  DEMO DATA
# ─────────────────────────────────────────────

def demo_data() -> list:
    hoy = datetime.date.today()
    print("\n⚠  MODO DEMO — datos de ejemplo")
    return [
        {"CodigoExterno": "2567-21-LP24", "Nombre": "Recolección y transporte REAS Hospital Regional", "NombreOrganismo": "Hospital Regional de Antofagasta", "NombreRegion": "Antofagasta", "Tipo": "LP", "_Estado": "publicada", "_KeywordMatch": "residuos hospitalarios", "FechaPublicacion": hoy.strftime("%d/%m/%Y"), "FechaCierre": (hoy + datetime.timedelta(days=3)).strftime("%d/%m/%Y"), "FechaAdjudicacion": "", "MontoEstimado": 85000000, "Descripcion": "Servicio integral de manejo de residuos hospitalarios."},
        {"CodigoExterno": "2201-15-LE24", "Nombre": "Gestión REAS Clínica Los Andes", "NombreOrganismo": "Clínica Los Andes", "NombreRegion": "Metropolitana de Santiago", "Tipo": "LE", "_Estado": "publicada", "_KeywordMatch": "REAS", "FechaPublicacion": hoy.strftime("%d/%m/%Y"), "FechaCierre": (hoy + datetime.timedelta(days=12)).strftime("%d/%m/%Y"), "FechaAdjudicacion": "", "MontoEstimado": 42000000, "Descripcion": "Residuos peligrosos biomédicos y anatomopatológicos."},
        {"CodigoExterno": "1890-44-L124", "Nombre": "Eliminación residuos peligrosos Hospital Osorno", "NombreOrganismo": "Hospital Base de Osorno", "NombreRegion": "Los Lagos", "Tipo": "L1", "_Estado": "publicada", "_KeywordMatch": "residuos peligrosos", "FechaPublicacion": hoy.strftime("%d/%m/%Y"), "FechaCierre": (hoy + datetime.timedelta(days=25)).strftime("%d/%m/%Y"), "FechaAdjudicacion": "", "MontoEstimado": 18000000, "Descripcion": "Residuos clínicos y cortopunzantes."},
        {"CodigoExterno": "3012-88-LE23", "Nombre": "Tratamiento REAS CESFAM Valparaíso", "NombreOrganismo": "CESFAM Dr. Víctor Manuel Fernández", "NombreRegion": "Valparaíso", "Tipo": "LE", "_Estado": "cerrada", "_KeywordMatch": "tratamiento de residuos", "FechaPublicacion": (hoy - datetime.timedelta(days=45)).strftime("%d/%m/%Y"), "FechaCierre": (hoy - datetime.timedelta(days=15)).strftime("%d/%m/%Y"), "FechaAdjudicacion": "", "MontoEstimado": 31500000, "Descripcion": "Tratamiento de residuos hospitalarios."},
        {"CodigoExterno": "4455-12-LP23", "Nombre": "Manejo residuos biomédicos Hospital Sótero del Río", "NombreOrganismo": "Complejo Asistencial Dr. Sótero del Río", "NombreRegion": "Metropolitana de Santiago", "Tipo": "LP", "_Estado": "adjudicada", "_KeywordMatch": "residuos biomedicos", "FechaPublicacion": (hoy - datetime.timedelta(days=90)).strftime("%d/%m/%Y"), "FechaCierre": (hoy - datetime.timedelta(days=60)).strftime("%d/%m/%Y"), "FechaAdjudicacion": (hoy - datetime.timedelta(days=30)).strftime("%d/%m/%Y"), "MontoEstimado": 120000000, "Descripcion": "Manejo integral de residuos biomédicos."},
        {"CodigoExterno": "5678-33-L124", "Nombre": "Recolección REAS Hospital de Curicó", "NombreOrganismo": "Hospital de Curicó", "NombreRegion": "Maule", "Tipo": "L1", "_Estado": "publicada", "_KeywordMatch": "REAS", "FechaPublicacion": hoy.strftime("%d/%m/%Y"), "FechaCierre": (hoy + datetime.timedelta(days=8)).strftime("%d/%m/%Y"), "FechaAdjudicacion": "", "MontoEstimado": 9500000, "Descripcion": "Recolección y transporte de residuos de salud."},
    ]


# ─────────────────────────────────────────────
#  MAIN
# ─────────────────────────────────────────────

def main():
    print("=" * 55)
    print("  REASY — Sync Mercado Público → Supabase")
    print(f"  {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 55)

    if not SUPABASE_URL or not SUPABASE_KEY:
        print("\n✗ SUPABASE_URL y SUPABASE_SERVICE_KEY son requeridas.")
        sys.exit(1)

    # Obtener datos
    if not API_TICKET or API_TICKET == "INGRESA_TU_TICKET_AQUI":
        raw = demo_data()
    else:
        print(f"\n🔑 Ticket: ...{API_TICKET[-6:]}")
        raw = buscar_todas(API_TICKET)
        if not raw:
            print("⚠ Sin resultados. Usando demo.")
            raw = demo_data()

    print(f"\n⚙  Procesando {len(raw)} licitaciones...")
    licitaciones = procesar(raw)

    # Guardar en Supabase
    print("💾 Guardando en Supabase...")
    result = supabase_upsert("licitaciones", licitaciones)
    print(f"✅ {result['count']} registros guardados")

    # Log
    activas = [l for l in licitaciones if l["estado"] == "publicada"]
    urgentes = sum(1 for l in activas if l["semaforo"] == "urgente")
    supabase_log(total=len(licitaciones), nuevas=len(licitaciones), actualizadas=0)

    print(f"\n📊 Activas: {len(activas)} | 🔴 Urgentes: {urgentes}")
    print("=" * 55)


if __name__ == "__main__":
    main()
