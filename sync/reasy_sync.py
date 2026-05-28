"""
REASY — Sync de Licitaciones a Supabase
Estrategia: buscar por fecha (API oficial) y filtrar REAS localmente.
Consulta los últimos DIAS_ATRAS días para capturar todas las activas.
"""

import os
import sys
import time
import datetime
import requests

# ─────────────────────────────────────────────
#  CONFIG
# ─────────────────────────────────────────────

API_TICKET    = os.environ.get("MERCADO_PUBLICO_TICKET", "")
SUPABASE_URL  = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY  = os.environ.get("SUPABASE_SERVICE_KEY", "")
RESEND_KEY    = os.environ.get("RESEND_API_KEY", "")

USUARIOS_EMAIL = [
    "cdemartini@reasy.cl",
    "ndemartini@reasy.cl",
    "carlosdemartini@reasy.cl",
]

BASE_URL = "https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json"

ALERTA_ROJA_DIAS     = 5
ALERTA_AMARILLA_DIAS = 15

# Cuántos días hacia atrás buscar (captura licitaciones aún abiertas)
DIAS_ATRAS = 90

ESTADOS_BUSQUEDA = ["publicada", "cerrada", "adjudicada"]

# Keywords de respaldo si Supabase no responde
PALABRAS_CLAVE_BACKUP = [
    "residuos hospitalarios", "residuos peligrosos", "reas",
    "manejo de residuos", "gestión de residuos", "gestion de residuos",
    "residuos biomedicos", "residuos biomédicos",
    "eliminacion de residuos", "eliminación de residuos",
    "tratamiento de residuos", "residuos sanitarios",
    "residuos clínicos", "residuos clinicos",
    "incineración de residuos", "incineracion de residuos",
    "transporte de residuos peligrosos", "residuos anatomopatológicos",
    "residuos anatomopatologicos", "cortopunzantes", "autoclave",
]

# ─────────────────────────────────────────────
#  API MERCADO PÚBLICO
# ─────────────────────────────────────────────

def obtener_keywords() -> list:
    """Lee las palabras clave activas desde Supabase. Usa backup si falla."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        return PALABRAS_CLAVE_BACKUP
    try:
        url = f"{SUPABASE_URL}/rest/v1/keywords?activa=eq.true&select=palabra"
        headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}
        resp = requests.get(url, headers=headers, timeout=10)
        resp.raise_for_status()
        palabras = [r["palabra"] for r in resp.json()]
        if palabras:
            print(f"✓ {len(palabras)} keywords cargadas desde Supabase")
            return palabras
    except Exception as e:
        print(f"⚠ Error leyendo keywords de Supabase: {e}")
    print("→ Usando keywords de respaldo")
    return PALABRAS_CLAVE_BACKUP


def buscar_por_fecha(ticket: str, fecha: datetime.date, estado: str) -> list:
    """Obtiene todas las licitaciones publicadas en una fecha y estado dado."""
    fecha_str = fecha.strftime("%d%m%Y")
    try:
        resp = requests.get(
            BASE_URL,
            params={"ticket": ticket, "fecha": fecha_str, "estado": estado},
            timeout=30
        )
        if resp.status_code == 429:
            print(f"  ⚠ Rate limit, esperando 5s...")
            time.sleep(5)
            return buscar_por_fecha(ticket, fecha, estado)
        resp.raise_for_status()
        return resp.json().get("Listado", [])
    except Exception as e:
        print(f"  ⚠ Error ({fecha_str}, {estado}): {e}")
        return []


def es_reas(licitacion: dict, palabras_clave: list) -> str | None:
    """Retorna la keyword que coincide si la licitación es REAS, None si no."""
    texto = " ".join([
        licitacion.get("Nombre", ""),
        licitacion.get("Descripcion", ""),
    ]).lower()
    for kw in palabras_clave:
        if kw in texto:
            return kw
    return None


def buscar_todas(ticket: str) -> list:
    """Busca en los últimos DIAS_ATRAS días y filtra licitaciones REAS."""
    palabras_clave = obtener_keywords()
    encontradas = {}
    hoy = datetime.date.today()

    for estado in ESTADOS_BUSQUEDA:
        print(f"\n🔍 Estado: {estado.upper()}")
        for dias in range(DIAS_ATRAS):
            fecha = hoy - datetime.timedelta(days=dias)
            time.sleep(1.2)
            resultados = buscar_por_fecha(ticket, fecha, estado)

            nuevas = 0
            for lic in resultados:
                codigo = lic.get("CodigoExterno", "")
                if not codigo or codigo in encontradas:
                    continue
                keyword = es_reas(lic, palabras_clave)
                if keyword:
                    lic["_Estado"] = estado
                    lic["_KeywordMatch"] = keyword
                    encontradas[codigo] = lic
                    nuevas += 1

            if resultados:
                print(f"   {fecha.strftime('%d/%m')} → {len(resultados)} total, {nuevas} REAS nuevas")

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


def calcular_score(tipo: str, monto, dias, es_renovable: bool) -> int:
    """Score 0-100 que indica qué tan atractiva es la oportunidad para REASY."""
    score = 0

    # Tipo / tamaño del contrato (0-35 pts)
    tipo_pts = {"L1": 5, "LE": 15, "LP": 25, "LQ": 30, "LR": 35}
    score += tipo_pts.get(tipo, 0)

    # Monto estimado en CLP (0-30 pts)
    m = monto or 0
    if m >= 50_000_000:   score += 30
    elif m >= 10_000_000: score += 20
    elif m >= 2_000_000:  score += 10
    elif m > 0:           score += 5

    # Días restantes — ventana ideal 7-40 días (0-25 pts)
    if dias is not None and dias >= 0:
        if 7 <= dias <= 20:    score += 25
        elif 20 < dias <= 40:  score += 15
        elif 3 <= dias < 7:    score += 10
        elif dias > 40:        score += 5

    # Contrato renovable — valor adicional (0-10 pts)
    if es_renovable:
        score += 10

    return min(score, 100)


def procesar(raw_list: list) -> list:
    resultado = []
    hoy = datetime.date.today()

    for lic in raw_list:
        # La API anida las fechas en Fechas/{} o en el root
        fechas = lic.get("Fechas", {}) or {}
        fecha_cierre_str = lic.get("FechaCierre") or fechas.get("FechaCierre", "")
        fecha_pub_str    = lic.get("FechaPublicacion") or fechas.get("FechaPublicacion", "")
        fecha_adj_str    = fechas.get("FechaAdjudicacion", "")

        # Organismo puede venir anidado en Comprador
        comprador = lic.get("Comprador", {}) or {}
        organismo = lic.get("NombreOrganismo") or comprador.get("NombreOrganismo", "")
        region    = lic.get("NombreRegion") or comprador.get("RegionUnidad", "")

        fecha_cierre = parsear_fecha(fecha_cierre_str)
        fecha_pub    = parsear_fecha(fecha_pub_str)
        fecha_adj    = parsear_fecha(fecha_adj_str)

        dias = (fecha_cierre - hoy).days if fecha_cierre else None

        try:
            monto = float(str(lic.get("MontoEstimado", "") or "").replace(".", "").replace(",", "."))
            monto = int(monto) if monto else None
        except Exception:
            monto = None

        codigo = lic.get("CodigoExterno", "")

        # Duración contrato
        duracion_val  = lic.get("TiempoDuracionContrato")
        duracion_tipo = lic.get("TipoDuracionContrato", "")
        duracion = f"{duracion_val} {duracion_tipo}".strip() if duracion_val else None

        # Adjudicación
        adj = lic.get("Adjudicacion", {}) or {}

        resultado.append({
            "codigo":               codigo,
            "nombre":               lic.get("Nombre", ""),
            "organismo":            organismo,
            "region":               region,
            "tipo":                 lic.get("Tipo", ""),
            "estado":               lic.get("_Estado", lic.get("CodigoEstado", "")),
            "keyword_match":        lic.get("_KeywordMatch", ""),
            "fecha_pub":            fecha_pub.isoformat() if fecha_pub else None,
            "fecha_cierre":         fecha_cierre.isoformat() if fecha_cierre else None,
            "fecha_adj":            fecha_adj.isoformat() if fecha_adj else None,
            "dias_restantes":       dias,
            "semaforo":             semaforo(dias),
            "monto_estimado":       monto,
            "moneda":               lic.get("Moneda", "CLP"),
            "descripcion":          lic.get("Descripcion", ""),
            "duracion_contrato":    duracion,
            "es_renovable":         bool(lic.get("EsRenovable", False)),
            "responsable_nombre":   lic.get("NombreResponsableContrato", "") or comprador.get("NombreUsuario", ""),
            "responsable_email":    lic.get("EmailResponsableContrato", ""),
            "responsable_fono":     lic.get("FonoResponsableContrato", ""),
            "direccion_unidad":     comprador.get("DireccionUnidad", ""),
            "comuna_unidad":        comprador.get("ComunaUnidad", ""),
            "url_acta":             adj.get("UrlActa", ""),
            "url":                  f"https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?qs={codigo}",
            "score":                calcular_score(
                                        lic.get("Tipo", ""),
                                        monto,
                                        dias,
                                        bool(lic.get("EsRenovable", False))
                                    ),
            "updated_at":           datetime.datetime.utcnow().isoformat(),
        })

    return resultado


# ─────────────────────────────────────────────
#  SUPABASE
# ─────────────────────────────────────────────

def supabase_upsert(tabla: str, registros: list) -> int:
    if not registros:
        return 0

    url = f"{SUPABASE_URL}/rest/v1/{tabla}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }

    total = 0
    for i in range(0, len(registros), 500):
        batch = registros[i:i + 500]
        resp = requests.post(url, headers=headers, json=batch, timeout=30)
        if not resp.ok:
            print(f"  ⚠ Supabase error {resp.status_code}: {resp.text[:200]}")
        else:
            total += len(batch)
    return total


def enviar_resumen_semanal(keywords: list, total_activas: int, urgentes: int):
    """Envía resumen semanal los lunes cuando no hay licitaciones nuevas."""
    if not RESEND_KEY:
        return

    kw_html = "".join(
        f'<span style="display:inline-block;margin:3px;padding:4px 10px;background:#EDF2F4;border:1px solid #D9E1E5;border-radius:6px;font-size:12px;color:#0A2233;font-family:monospace;">{kw}</span>'
        for kw in keywords
    )

    html = f"""
    <div style="font-family:Inter,system-ui,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
      <div style="background:#0A2233;padding:24px 32px;">
        <p style="color:#55B1BF;font-size:11px;margin:0 0 6px;letter-spacing:0.05em;text-transform:uppercase;">IA REASY · Resumen Semanal</p>
        <h1 style="color:#fff;font-size:20px;margin:0;font-weight:600;">Sin licitaciones nuevas esta semana</h1>
        <p style="color:#94a3b8;margin:6px 0 0;font-size:13px;">
          Semana del {datetime.date.today().strftime('%-d de %B de %Y')}
        </p>
      </div>
      <div style="padding:24px 32px;">
        <div style="display:flex;gap:16px;margin-bottom:24px;">
          <div style="flex:1;background:#EDF2F4;border-radius:10px;padding:16px;text-align:center;">
            <p style="font-size:28px;font-weight:700;color:#0A2233;margin:0;">{total_activas}</p>
            <p style="font-size:12px;color:#6b7280;margin:4px 0 0;">licitaciones activas</p>
          </div>
          <div style="flex:1;background:#fef2f2;border-radius:10px;padding:16px;text-align:center;">
            <p style="font-size:28px;font-weight:700;color:#b91c1c;margin:0;">{urgentes}</p>
            <p style="font-size:12px;color:#6b7280;margin:4px 0 0;">urgentes (≤5 días)</p>
          </div>
        </div>
        <p style="font-size:13px;color:#374151;margin:0 0 12px;">
          Las siguientes <strong>{len(keywords)} palabras clave</strong> están activas en el sistema.
          Si llevan varios días sin resultados, considera agregar nuevas variantes.
        </p>
        <div style="margin-bottom:24px;">{kw_html}</div>
        <div style="text-align:center;">
          <a href="https://reasy-mercado.vercel.app/dashboard/keywords"
             style="background:#55B1BF;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;display:inline-block;">
            Gestionar keywords →
          </a>
        </div>
      </div>
      <div style="padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center;">
        <p style="color:#9ca3af;font-size:11px;margin:0;">IA REASY · Sistema de Oportunidades Mercado Público</p>
      </div>
    </div>"""

    try:
        resp = requests.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {RESEND_KEY}", "Content-Type": "application/json"},
            json={
                "from": "IA REASY <IA@reasy.cl>",
                "to": USUARIOS_EMAIL,
                "subject": f"📋 Resumen semanal REASY — {total_activas} activas, sin novedades esta semana",
                "html": html,
            },
            timeout=15
        )
        if resp.ok:
            print(f"📧 Resumen semanal enviado a {len(USUARIOS_EMAIL)} usuarios")
        else:
            print(f"  ⚠ Email error: {resp.text[:100]}")
    except Exception as e:
        print(f"  ⚠ Email error: {e}")


def obtener_nuevas_hoy() -> list:
    """Retorna licitaciones publicadas insertadas hoy por primera vez (via primera_vez_vista)."""
    hoy = datetime.date.today().isoformat()
    headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}
    url = (
        f"{SUPABASE_URL}/rest/v1/licitaciones"
        f"?select=*&primera_vez_vista=eq.{hoy}&estado=eq.publicada&order=score.desc.nullslast"
    )
    try:
        resp = requests.get(url, headers=headers, timeout=15)
        if resp.ok:
            return resp.json()
        print(f"  ⚠ Supabase nuevas error {resp.status_code}: {resp.text[:100]}")
    except Exception as e:
        print(f"  ⚠ Error obteniendo nuevas hoy: {e}")
    return []


def enviar_email_nuevas(nuevas: list):
    """Envía email con las nuevas licitaciones detectadas hoy."""
    if not RESEND_KEY or not nuevas:
        return

    SEMAFORO_COLOR = {
        'urgente':   ('#b91c1c', '🔴'),
        'proximo':   ('#b45309', '🟡'),
        'con_tiempo':('#065f46', '🟢'),
    }

    filas_html = ""
    for l in sorted(nuevas, key=lambda x: x.get('dias_restantes') or 999):
        dias     = l.get('dias_restantes')
        color, dot = SEMAFORO_COLOR.get(l.get('semaforo', ''), ('#374151', '⚪'))
        dias_str = f"{dias}d" if dias is not None and dias >= 0 else "—"
        monto_str = f"${l['monto_estimado']:,.0f}" if l.get('monto_estimado') else "—"
        filas_html += f"""
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">
            {dot}&nbsp;<a href="{l['url']}" style="color:#0A2233;font-weight:600;text-decoration:none;">{l['nombre'][:80]}</a>
            <br><span style="color:#6b7280;font-size:12px;">{l['organismo']} · {l.get('region','')}</span>
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:700;color:{color};white-space:nowrap;">
            {dias_str}
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;color:#374151;white-space:nowrap;">
            {monto_str}
          </td>
        </tr>"""

    n = len(nuevas)
    html = f"""
    <div style="font-family:Inter,system-ui,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
      <div style="background:#0A2233;padding:24px 32px;">
        <p style="color:#55B1BF;font-size:11px;margin:0 0 6px;letter-spacing:0.05em;text-transform:uppercase;">IA REASY · Mercado Público Chile</p>
        <h1 style="color:#fff;font-size:20px;margin:0;font-weight:600;">
          {n} nueva{'s' if n > 1 else ''} licitación{'es' if n > 1 else ''} REAS
        </h1>
        <p style="color:#94a3b8;margin:6px 0 0;font-size:13px;">
          {datetime.date.today().strftime('%-d de %B de %Y')}
        </p>
      </div>
      <div style="padding:24px 32px;">
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#EDF2F4;">
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;">Licitación</th>
              <th style="padding:10px 12px;text-align:center;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;">Cierre</th>
              <th style="padding:10px 12px;text-align:right;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;">Monto</th>
            </tr>
          </thead>
          <tbody>{filas_html}</tbody>
        </table>
        <div style="margin-top:24px;text-align:center;">
          <a href="https://reasy-mercado.vercel.app/dashboard"
             style="background:#55B1BF;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;display:inline-block;">
            Ver en dashboard →
          </a>
        </div>
      </div>
      <div style="padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center;">
        <p style="color:#9ca3af;font-size:11px;margin:0;">IA REASY · Sistema de Oportunidades Mercado Público</p>
      </div>
    </div>"""

    try:
        resp = requests.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {RESEND_KEY}", "Content-Type": "application/json"},
            json={
                "from": "IA REASY <IA@reasy.cl>",
                "to": USUARIOS_EMAIL,
                "subject": f"{'🔴' if any(l.get('semaforo')=='urgente' for l in nuevas) else '🆕'} {n} nueva{'s' if n>1 else ''} licitación{'es' if n>1 else ''} REAS en Mercado Público",
                "html": html,
            },
            timeout=15
        )
        if resp.ok:
            print(f"📧 Email enviado a {len(USUARIOS_EMAIL)} usuarios ({n} nuevas licitaciones)")
        else:
            print(f"  ⚠ Email error: {resp.text[:100]}")
    except Exception as e:
        print(f"  ⚠ Email error: {e}")


def supabase_log(total: int, modo: str):
    url = f"{SUPABASE_URL}/rest/v1/sync_log"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    requests.post(url, headers=headers, json={
        "total": total, "nuevas": total, "actualizadas": 0,
        "modo": modo, "created_at": datetime.datetime.utcnow().isoformat(),
    }, timeout=10)


# ─────────────────────────────────────────────
#  DEMO DATA
# ─────────────────────────────────────────────

def demo_data() -> list:
    hoy = datetime.date.today()
    print("\n⚠  MODO DEMO — datos de ejemplo")
    return [
        {"CodigoExterno": "2567-21-LP24", "Nombre": "Recolección y transporte REAS Hospital Regional", "NombreOrganismo": "Hospital Regional de Antofagasta", "NombreRegion": "Antofagasta", "Tipo": "LP", "_Estado": "publicada", "_KeywordMatch": "residuos hospitalarios", "FechaPublicacion": hoy.strftime("%d/%m/%Y"), "FechaCierre": (hoy + datetime.timedelta(days=3)).strftime("%d/%m/%Y"), "FechaAdjudicacion": "", "MontoEstimado": 85000000, "Descripcion": "Servicio integral de manejo de residuos hospitalarios."},
        {"CodigoExterno": "2201-15-LE24", "Nombre": "Gestión REAS Clínica Los Andes", "NombreOrganismo": "Clínica Los Andes", "NombreRegion": "Metropolitana de Santiago", "Tipo": "LE", "_Estado": "publicada", "_KeywordMatch": "reas", "FechaPublicacion": hoy.strftime("%d/%m/%Y"), "FechaCierre": (hoy + datetime.timedelta(days=12)).strftime("%d/%m/%Y"), "FechaAdjudicacion": "", "MontoEstimado": 42000000, "Descripcion": "Residuos peligrosos biomédicos y anatomopatológicos."},
        {"CodigoExterno": "1890-44-L124", "Nombre": "Eliminación residuos peligrosos Hospital Osorno", "NombreOrganismo": "Hospital Base de Osorno", "NombreRegion": "Los Lagos", "Tipo": "L1", "_Estado": "publicada", "_KeywordMatch": "residuos peligrosos", "FechaPublicacion": hoy.strftime("%d/%m/%Y"), "FechaCierre": (hoy + datetime.timedelta(days=25)).strftime("%d/%m/%Y"), "FechaAdjudicacion": "", "MontoEstimado": 18000000, "Descripcion": "Residuos clínicos y cortopunzantes."},
        {"CodigoExterno": "3012-88-LE23", "Nombre": "Tratamiento REAS CESFAM Valparaíso", "NombreOrganismo": "CESFAM Dr. Víctor Manuel Fernández", "NombreRegion": "Valparaíso", "Tipo": "LE", "_Estado": "cerrada", "_KeywordMatch": "tratamiento de residuos", "FechaPublicacion": (hoy - datetime.timedelta(days=45)).strftime("%d/%m/%Y"), "FechaCierre": (hoy - datetime.timedelta(days=15)).strftime("%d/%m/%Y"), "FechaAdjudicacion": "", "MontoEstimado": 31500000, "Descripcion": "Tratamiento de residuos hospitalarios."},
        {"CodigoExterno": "4455-12-LP23", "Nombre": "Manejo residuos biomédicos Hospital Sótero del Río", "NombreOrganismo": "Complejo Asistencial Dr. Sótero del Río", "NombreRegion": "Metropolitana de Santiago", "Tipo": "LP", "_Estado": "adjudicada", "_KeywordMatch": "residuos biomedicos", "FechaPublicacion": (hoy - datetime.timedelta(days=90)).strftime("%d/%m/%Y"), "FechaCierre": (hoy - datetime.timedelta(days=60)).strftime("%d/%m/%Y"), "FechaAdjudicacion": (hoy - datetime.timedelta(days=30)).strftime("%d/%m/%Y"), "MontoEstimado": 120000000, "Descripcion": "Manejo integral de residuos biomédicos."},
        {"CodigoExterno": "5678-33-L124", "Nombre": "Recolección REAS Hospital de Curicó", "NombreOrganismo": "Hospital de Curicó", "NombreRegion": "Maule", "Tipo": "L1", "_Estado": "publicada", "_KeywordMatch": "reas", "FechaPublicacion": hoy.strftime("%d/%m/%Y"), "FechaCierre": (hoy + datetime.timedelta(days=8)).strftime("%d/%m/%Y"), "FechaAdjudicacion": "", "MontoEstimado": 9500000, "Descripcion": "Recolección y transporte de residuos de salud."},
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

    if not API_TICKET or API_TICKET == "INGRESA_TU_TICKET_AQUI":
        raw = demo_data()
        modo = "demo"
    else:
        print(f"\n🔑 Ticket: ...{API_TICKET[-6:]}")
        print(f"📅 Buscando últimos {DIAS_ATRAS} días por fecha + filtro REAS local")
        raw = buscar_todas(API_TICKET)
        modo = "api"
        if not raw:
            print("⚠ Sin resultados REAS. Usando demo.")
            raw = demo_data()
            modo = "demo"

    print(f"\n⚙  Procesando {len(raw)} licitaciones REAS...")
    licitaciones = procesar(raw)

    print("💾 Guardando en Supabase...")
    total = supabase_upsert("licitaciones", licitaciones)
    print(f"✅ {total} registros guardados")

    activas = [l for l in licitaciones if l["estado"] == "publicada"]
    supabase_log(total=len(licitaciones), modo=modo)

    # Detectar nuevas via primera_vez_vista (más confiable que comparar antes del upsert)
    nuevas = obtener_nuevas_hoy()

    print(f"\n📊 Total REAS: {len(licitaciones)} | Activas: {len(activas)} | 🆕 Nuevas hoy: {len(nuevas)}")

    if nuevas:
        enviar_email_nuevas(nuevas)
    else:
        print("📧 Sin licitaciones nuevas hoy")
        if datetime.date.today().weekday() == 0:  # Lunes
            palabras_clave_activas = obtener_keywords()
            urgentes_hoy = len([l for l in activas if l.get("semaforo") == "urgente"])
            enviar_resumen_semanal(palabras_clave_activas, len(activas), urgentes_hoy)
    print("=" * 55)


if __name__ == "__main__":
    main()
