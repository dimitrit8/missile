from fastapi import FastAPI, APIRouter, HTTPException, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
import aiohttp
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from accurate_missile_data import MISSILE_SPECIFICATIONS, DATA_SOURCES, LAST_UPDATED, DATA_ACCURACY_NOTE
from data_updater import periodic_update_task, trigger_manual_update
from missile3d_config import get_glb_url, has_glb_model, GDRIVE_DOWNLOAD_URL
from fastapi.responses import StreamingResponse, Response
from x_api_handler import XAPIHandler
from real_time_ingester import RealTimeStrikeIngester

# Admin password for analytics dashboard
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'missile2024admin')

# Initialize X API handler for real-time OSINT tweet fetching
x_api_handler = XAPIHandler()

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Define Models
class Conflict(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    regions: List[str]
    start_date: str
    end_date: Optional[str] = None
    total_missiles: int
    total_intercepted: int
    total_casualties: int
    total_deceased: int
    total_cost: float

class MissileStrike(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    conflict_id: str
    date: str
    location: str
    country: str
    latitude: float
    longitude: float
    missile_type: str
    missile_cost: float
    launch_location: Optional[str] = None
    intercepted: bool
    interceptor_type: Optional[str] = None
    interceptor_cost: Optional[float] = None
    interception_location: Optional[str] = None
    casualties: int
    deceased: int
    description: str

class MissileType(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    type: str
    country: str
    cost: float
    range_km: Optional[int] = None

class Statistics(BaseModel):
    model_config = ConfigDict(extra="ignore")
    total_conflicts: int
    total_strikes: int
    total_intercepted: int
    interception_rate: float
    total_casualties: int
    total_deceased: int
    total_missile_cost: float
    total_defense_cost: float
    strikes_by_conflict: dict
    strikes_by_month: List[dict]

# Routes
@api_router.get("/")
async def root():
    return {"message": "Missile Tracking Dashboard API"}

@api_router.get("/conflicts", response_model=List[Conflict])
async def get_conflicts():
    conflicts = await db.conflicts.find({}, {"_id": 0}).to_list(1000)
    return conflicts

@api_router.get("/strikes", response_model=List[MissileStrike])
async def get_strikes(conflict_id: Optional[str] = None, limit: int = 1000):
    query = {}
    if conflict_id:
        query["conflict_id"] = conflict_id
    strikes = await db.strikes.find(query, {"_id": 0}).to_list(limit)
    return strikes

@api_router.get("/missile-types", response_model=List[MissileType])
async def get_missile_types():
    types = await db.missile_types.find({}, {"_id": 0}).to_list(1000)
    return types

@api_router.get("/statistics", response_model=Statistics)
async def get_statistics():
    # Get conflicts with real aggregated numbers
    conflicts = await db.conflicts.find({}, {"_id": 0}).to_list(1000)
    
    # Use conflict aggregate data for statistics (real numbers)
    total_strikes = sum(c["total_missiles"] for c in conflicts)
    total_intercepted = sum(c["total_intercepted"] for c in conflicts)
    total_casualties = sum(c["total_casualties"] for c in conflicts)
    total_deceased = sum(c["total_deceased"] for c in conflicts)
    total_missile_cost = sum(c["total_cost"] for c in conflicts)
    
    # Calculate interception rate
    interception_rate = (total_intercepted / total_strikes * 100) if total_strikes > 0 else 0
    
    # Estimate defense cost (average interceptor cost * intercepted missiles)
    avg_interceptor_cost = 1000000  # $1M average
    total_defense_cost = total_intercepted * avg_interceptor_cost
    
    # Strikes by conflict
    strikes_by_conflict = {c["name"]: c["total_missiles"] for c in conflicts}
    
    # Generate monthly timeline based on conflict data
    from datetime import datetime
    from dateutil.relativedelta import relativedelta
    
    strikes_by_month = []
    current_date = datetime.now()
    
    # Generate last 12 months of data
    for i in range(11, -1, -1):
        month_date = current_date - relativedelta(months=i)
        month_key = month_date.strftime("%Y-%m")
        
        # Distribute strikes across months (rough approximation)
        month_strikes = total_strikes // 48  # ~4 years of data
        strikes_by_month.append({"month": month_key, "count": month_strikes})
    
    return Statistics(
        total_conflicts=len(conflicts),
        total_strikes=total_strikes,
        total_intercepted=total_intercepted,
        interception_rate=round(interception_rate, 1),
        total_casualties=total_casualties,
        total_deceased=total_deceased,
        total_missile_cost=total_missile_cost,
        total_defense_cost=total_defense_cost,
        strikes_by_conflict=strikes_by_conflict,
        strikes_by_month=strikes_by_month
    )

@api_router.get("/missile-specifications/{missile_id}")
async def get_missile_specification(missile_id: str):
    """Get detailed specifications for a specific missile type"""
    if missile_id not in MISSILE_SPECIFICATIONS:
        raise HTTPException(status_code=404, detail="Missile type not found")
    return MISSILE_SPECIFICATIONS[missile_id]

@api_router.get("/missile-specifications")
async def get_all_missile_specifications():
    """Get all missile specifications"""
    return {
        "missiles": MISSILE_SPECIFICATIONS,
        "data_sources": DATA_SOURCES,
        "last_updated": LAST_UPDATED,
        "accuracy_note": DATA_ACCURACY_NOTE
    }

@api_router.get("/disclaimer")
async def get_disclaimer():
    """Get data disclaimer and sources"""
    return {
        "disclaimer": DATA_ACCURACY_NOTE,
        "data_sources": DATA_SOURCES,
        "last_updated": LAST_UPDATED,
        "methodology": "Data aggregated from official conflict statistics, news reports, and defense analysis. Individual strike data represents verified incidents and statistical samples.",
        "limitations": [
            "Exact hit times not available for all strikes due to security and reporting delays",
            "Some casualty figures are estimates based on verified reports",
            "Individual strike locations represent verified incidents, not exhaustive lists",
            "Missile costs are manufacturer/procurement estimates and may vary",
            "Classified specifications are not included"
        ]
    }

@api_router.post("/admin/update-data")
async def manual_data_update():
    """Manually trigger data update (for admin use)"""
    try:
        success = await trigger_manual_update(db)
        if success:
            return {"status": "success", "message": "Data updated successfully", "timestamp": datetime.now(timezone.utc).isoformat()}
        else:
            raise HTTPException(status_code=500, detail="Update failed")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/last-update")
async def get_last_update():
    """Get timestamp of last data update"""
    conflicts = await db.conflicts.find({}, {"_id": 0, "last_updated": 1}).to_list(1)
    if conflicts and "last_updated" in conflicts[0]:
        return {"last_updated": conflicts[0]["last_updated"]}
    return {"last_updated": LAST_UPDATED}

@api_router.get("/news-feed")
async def get_news_feed():
    """Get latest conflict news from GDELT"""
    news = await db.news_feed.find({}, {"_id": 0}).sort("fetched_at", -1).to_list(50)
    return {"articles": news, "count": len(news)}

# ============== VISITOR TRACKING & ADMIN ANALYTICS ==============

async def get_geo_from_ip(ip: str):
    """Get geolocation data from IP using free ip-api.com"""
    try:
        if ip in ['127.0.0.1', 'localhost', '::1']:
            return {"country": "Local", "city": "Development", "countryCode": "LC"}
        async with aiohttp.ClientSession() as session:
            async with session.get(f"http://ip-api.com/json/{ip}?fields=status,country,countryCode,city,region,lat,lon", timeout=5) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    if data.get("status") == "success":
                        return data
        return {"country": "Unknown", "city": "Unknown", "countryCode": "XX"}
    except:
        return {"country": "Unknown", "city": "Unknown", "countryCode": "XX"}

@api_router.post("/track-visit")
async def track_visit(request: Request):
    """Track visitor for analytics"""
    try:
        # Get IP from headers (works behind proxy)
        forwarded = request.headers.get("x-forwarded-for")
        ip = forwarded.split(",")[0].strip() if forwarded else request.client.host
        
        # Get geolocation
        geo = await get_geo_from_ip(ip)
        
        # Store visit
        visit = {
            "ip": ip,
            "country": geo.get("country", "Unknown"),
            "country_code": geo.get("countryCode", "XX"),
            "city": geo.get("city", "Unknown"),
            "region": geo.get("region", ""),
            "lat": geo.get("lat"),
            "lon": geo.get("lon"),
            "user_agent": request.headers.get("user-agent", ""),
            "referer": request.headers.get("referer", ""),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "date": datetime.now(timezone.utc).strftime("%Y-%m-%d")
        }
        
        await db.visitors.insert_one(visit)
        return {"status": "tracked"}
    except Exception as e:
        logger.error(f"Error tracking visit: {e}")
        return {"status": "error"}

@api_router.get("/admin/analytics")
async def get_analytics(password: str):
    """Get visitor analytics (password protected)"""
    if password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid password")
    
    # Total visitors
    total_visitors = await db.visitors.count_documents({})
    
    # Today's visitors
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    today_visitors = await db.visitors.count_documents({"date": today})
    
    # Last 7 days
    seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")
    week_visitors = await db.visitors.count_documents({"date": {"$gte": seven_days_ago}})
    
    # Visitors by country
    country_pipeline = [
        {"$group": {"_id": "$country", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 20}
    ]
    countries = await db.visitors.aggregate(country_pipeline).to_list(20)
    
    # Visitors by city
    city_pipeline = [
        {"$group": {"_id": {"city": "$city", "country": "$country"}, "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 20}
    ]
    cities = await db.visitors.aggregate(city_pipeline).to_list(20)
    
    # Daily visitors (last 30 days)
    daily_pipeline = [
        {"$group": {"_id": "$date", "count": {"$sum": 1}}},
        {"$sort": {"_id": -1}},
        {"$limit": 30}
    ]
    daily = await db.visitors.aggregate(daily_pipeline).to_list(30)
    
    # Recent visitors (last 50)
    recent = await db.visitors.find({}, {"_id": 0}).sort("timestamp", -1).to_list(50)
    
    # Unique IPs
    unique_ips = len(await db.visitors.distinct("ip"))
    
    return {
        "total_visitors": total_visitors,
        "unique_visitors": unique_ips,
        "today_visitors": today_visitors,
        "week_visitors": week_visitors,
        "by_country": [{"country": c["_id"], "count": c["count"]} for c in countries],
        "by_city": [{"city": c["_id"]["city"], "country": c["_id"]["country"], "count": c["count"]} for c in cities],
        "daily": [{"date": d["_id"], "count": d["count"]} for d in daily],
        "recent_visitors": recent,
        "notifications_accepted": await db.push_subscriptions.count_documents({"active": True}),
        "notifications_total": await db.push_subscriptions.count_documents({}),
    }

# ============== PUSH NOTIFICATION OPT-IN ==============

class PushSubscriptionRecord(BaseModel):
    visitor_id: str          # anonymous ID generated client-side
    user_agent: Optional[str] = None
    accepted_at: Optional[str] = None
    active: bool = True

@api_router.post("/notifications/subscribe")
async def subscribe_notifications(payload: PushSubscriptionRecord):
    """Record that a visitor accepted push notifications."""
    now = datetime.now(timezone.utc).isoformat()
    await db.push_subscriptions.update_one(
        {"visitor_id": payload.visitor_id},
        {"$set": {
            "visitor_id": payload.visitor_id,
            "user_agent": payload.user_agent,
            "accepted_at": payload.accepted_at or now,
            "active": True,
            "updated_at": now,
        }},
        upsert=True,
    )
    return {"status": "ok"}

@api_router.post("/notifications/unsubscribe")
async def unsubscribe_notifications(payload: dict):
    """Mark a visitor as unsubscribed (they revoked permission)."""
    visitor_id = payload.get("visitor_id")
    if not visitor_id:
        raise HTTPException(status_code=400, detail="visitor_id required")
    await db.push_subscriptions.update_one(
        {"visitor_id": visitor_id},
        {"$set": {"active": False, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"status": "ok"}

@api_router.get("/notifications/stats")
async def notification_stats(password: str):
    """Admin: how many users accepted and are still active."""
    if password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid password")
    total     = await db.push_subscriptions.count_documents({})
    active    = await db.push_subscriptions.count_documents({"active": True})
    revoked   = total - active
    return {"total_opted_in": total, "currently_subscribed": active, "revoked": revoked}

# ============== 3D GLB MODEL PROXY ==============

@api_router.get("/glb-check/{missile_id}")
async def check_glb_model(missile_id: str):
    """Check whether a GLB model is configured for this missile ID"""
    available = has_glb_model(missile_id)
    return {"missile_id": missile_id, "available": available}

@api_router.get("/glb/{missile_id}")
async def proxy_glb_model(missile_id: str):
    """
    Proxy GLB file from Google Drive so the browser avoids CORS issues.
    Streams the binary GLB data directly to the client.
    """
    url = get_glb_url(missile_id)
    if not url:
        raise HTTPException(status_code=404, detail=f"No GLB model configured for '{missile_id}'. "
                            "Add its Google Drive file ID to backend/missile3d_config.py")

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=60)) as resp:
                if resp.status != 200:
                    raise HTTPException(status_code=502,
                                        detail=f"Google Drive returned HTTP {resp.status}. "
                                        "Make sure the file is shared as 'Anyone with the link'.")
                content = await resp.read()

        return StreamingResponse(
            iter([content]),
            media_type="model/gltf-binary",
            headers={
                "Content-Disposition": f'inline; filename="{missile_id}.glb"',
                "Cache-Control": "public, max-age=3600",
                "Access-Control-Allow-Origin": "*",
            }
        )
    except aiohttp.ClientError as e:
        logger.error(f"GLB proxy error for {missile_id}: {e}")
        raise HTTPException(status_code=502, detail="Failed to fetch GLB from Google Drive")

# ============== LIVE MISSILE EVENTS ==============

LIVE_SEARCH_QUERIES = [
    "missile strike launch fired",
    "rocket attack missile launched today",
    "drone strike missile fired conflict",
    "ballistic missile launched attack",
    "missile intercept defense shot down",
]

async def fetch_live_gdelt_articles(query: str, max_records: int = 15):
    """Fetch recent articles from GDELT DOC 2.0 for a live conflict query"""
    GDELT_DOC_API = "https://api.gdeltproject.org/api/v2/doc/doc"
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(hours=24)

    params = {
        "query": query,
        "mode": "artlist",
        "maxrecords": max_records,
        "format": "json",
        "startdatetime": start_date.strftime("%Y%m%d%H%M%S"),
        "enddatetime": end_date.strftime("%Y%m%d%H%M%S"),
        "sort": "datedesc",
        "sourcelang": "english",   # English-language sources only
    }
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(GDELT_DOC_API, params=params,
                                   timeout=aiohttp.ClientTimeout(total=20)) as resp:
                if resp.status == 200:
                    data = await resp.json(content_type=None)
                    articles = data.get("articles", [])
                    # Extra client-side filter: drop any that still slipped through as non-English
                    return [a for a in articles if a.get("language", "English").lower() in ("english", "eng", "")]
    except Exception as e:
        logger.warning(f"GDELT live fetch error: {e}")
    return []

@api_router.get("/live-events")
async def get_live_events():
    """
    Return real-time missile strike reports from X/Twitter OSINT accounts (primary),
    falling back to GDELT DOC 2.0 news articles if X API is not configured.

    X API provides real-time strike data from accounts like @OSINTtechnical,
    @OSINTdefender, @TheSpectatorIdx which report events within minutes of happening.
    """
    try:
        # Check cache first (avoid hammering APIs on every page load)
        cache_doc = await db.live_events_cache.find_one({"_id": "cache_events"})
        now = datetime.now(timezone.utc)

        # Refresh if cache is older than 3 minutes (shorter for real-time)
        if cache_doc:
            cached_at = datetime.fromisoformat(cache_doc.get("cached_at", "2000-01-01T00:00:00+00:00"))
            if (now - cached_at).total_seconds() < 180:
                return cache_doc.get("events", [])

        events = []

        # PRIMARY: Try X/Twitter OSINT accounts first (real-time)
        if x_api_handler.initialized:
            try:
                osint_strikes = await x_api_handler.fetch_recent_strikes_from_osint()
                for strike in osint_strikes:
                    events.append({
                        "title": f"[OSINT] {strike.get('missile_type', 'Missile')} strike on {strike.get('location', 'Unknown')}",
                        "url": f"https://twitter.com/search?q={strike.get('source', '')}",
                        "source": strike.get("source", "OSINT"),
                        "date": strike.get("timestamp", ""),
                        "language": "en",
                        "confidence": "high",
                    })
                logger.info(f"Fetched {len(osint_strikes)} real-time OSINT strike reports from X")
            except Exception as e:
                logger.warning(f"Error fetching X OSINT tweets: {e}")

        # FALLBACK: If no OSINT data or X API not configured, use GDELT
        if not events:
            all_articles = []
            for query in LIVE_SEARCH_QUERIES[:3]:
                articles = await fetch_live_gdelt_articles(query, max_records=15)
                all_articles.extend(articles)
                await asyncio.sleep(0.5)

            # Deduplicate by URL
            seen_urls = set()
            for a in all_articles:
                url = a.get("url", "")
                if url and url not in seen_urls:
                    seen_urls.add(url)
                    events.append({
                        "title": a.get("title", ""),
                        "url": url,
                        "source": a.get("domain", ""),
                        "date": a.get("seendate", ""),
                        "language": a.get("language", "en"),
                    })

        # Sort by date descending, cap at 40
        events.sort(key=lambda x: x.get("date", ""), reverse=True)
        events = events[:40]

        # Cache in MongoDB
        await db.live_events_cache.replace_one(
            {"_id": "cache_events"},
            {"_id": "cache_events", "events": events, "cached_at": now.isoformat()},
            upsert=True
        )

        return events
    except Exception as e:
        logger.error(f"Error fetching live events: {e}")
        return []

# ============== ADMIN INGESTION LOGS ==============

@api_router.get("/admin/logs")
async def get_ingestion_logs(password: str, limit: int = 50):
    """Return the most recent ingestion log entries for the admin dashboard."""
    if password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid password")
    logs = await db.ingestion_logs.find(
        {}, {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    return {"logs": logs, "count": len(logs)}

# ============== SITEMAP ==============

@api_router.get("/sitemap.xml", response_class=Response)
async def sitemap():
    """Generate sitemap.xml for search engine indexing"""
    base = "https://warinfo.net"

    # Static pages
    urls = [
        {"loc": f"{base}/",        "priority": "1.0", "changefreq": "daily"},
        {"loc": f"{base}/#/admin", "priority": "0.3", "changefreq": "monthly"},
    ]

    # One URL per conflict
    try:
        conflicts = await db.conflicts.find({}, {"_id": 0, "id": 1}).to_list(100)
        for c in conflicts:
            urls.append({
                "loc": f"{base}/#/conflict/{c['id']}",
                "priority": "0.8",
                "changefreq": "daily",
            })
    except Exception:
        pass

    xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    for u in urls:
        xml += (
            f'  <url>'
            f'<loc>{u["loc"]}</loc>'
            f'<changefreq>{u["changefreq"]}</changefreq>'
            f'<priority>{u["priority"]}</priority>'
            f'</url>\n'
        )
    xml += '</urlset>'

    return Response(content=xml, media_type="application/xml")

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# ── Hourly real-time strike ingestion background task ──────────────────────────
strike_ingester: Optional[RealTimeStrikeIngester] = None

async def run_hourly_ingestion():
    """Background coroutine: runs ingest_hourly() once per hour, forever."""
    while True:
        try:
            await strike_ingester.ingest_hourly()
        except Exception as e:
            logger.error(f"Hourly ingestion task error: {e}", exc_info=True)
        await asyncio.sleep(3600)   # wait 1 hour before next run

# Initialize database with data on startup
@app.on_event("startup")
async def initialize_database():
    global strike_ingester
    # Create unique indexes to prevent duplicates
    await db.conflicts.create_index("id", unique=True)
    await db.missile_types.create_index("id", unique=True)
    await db.strikes.create_index("id", unique=True)
    
    logger.info("Initializing/updating database with missile strike data...")

    # ── IMPORTANT: We do NOT delete existing data on startup ──────────────────
    # Deleting would wipe all strikes added by the real-time OSINT ingester.
    # Instead we use upsert — hardcoded entries are added if missing,
    # and ingester-added entries are preserved between restarts.

    # Conflict metadata — static fields always updated, dynamic stats (totals)
    # only set on first insert so the ingester can grow them over time.
    conflicts_data = [
        {
            "id": "russia-ukraine",
            "name": "Russia-Ukraine War",
            "regions": ["Ukraine", "Russia"],
            "start_date": "2022-02-24",
            "end_date": None,
            # Stats as of Apr 2026 — ingester will add to these going forward
            "total_missiles": 16500,
            "total_intercepted": 8200,
            "total_casualties": 61200,
            "total_deceased": 16800,
            "total_cost": 48000000000.0,
        },
        {
            "id": "israel-hamas",
            "name": "Israel-Hamas Conflict",
            "regions": ["Israel", "Gaza"],
            "start_date": "2023-10-07",
            "end_date": None,
            "total_missiles": 14800,
            "total_intercepted": 14300,
            "total_casualties": 220000,
            "total_deceased": 85000,
            "total_cost": 7400000.0,
        },
        {
            "id": "iran-israel",
            "name": "Iran-Israel-Lebanon War",
            "regions": ["Iran", "Israel", "Lebanon", "UAE", "Saudi Arabia", "Qatar"],
            "start_date": "2024-04-13",
            "end_date": None,
            # Updated Apr 2026: includes 12-Day War, Epic Fury, Gulf retaliation,
            # ongoing Lebanon escalation (160 missiles/100 targets on Apr 8 2026 alone)
            "total_missiles": 8200,
            "total_intercepted": 5100,
            "total_casualties": 58000,
            "total_deceased": 19400,
            "total_cost": 16000000000.0,
        },
    ]

    # Upsert conflicts:
    # - $set: always refresh static metadata (name, regions, dates)
    # - $setOnInsert: only write stats the very first time (won't overwrite ingester updates)
    for c in conflicts_data:
        static = {k: c[k] for k in ("id", "name", "regions", "start_date", "end_date")}
        stats  = {k: c[k] for k in ("total_missiles", "total_intercepted",
                                     "total_casualties", "total_deceased", "total_cost")}
        await db.conflicts.update_one(
            {"id": c["id"]},
            {"$set": static, "$setOnInsert": stats},
            upsert=True
        )
    
    # Missile types — upsert only (no delete, preserves any custom entries)

    # Insert missile types using upsert
    missile_types_data = []
    for missile_id, spec in MISSILE_SPECIFICATIONS.items():
        missile_types_data.append({
            "id": spec["id"],
            "name": spec["name"],
            "type": spec["type"],
            "country": spec["country"],
            "cost": spec["cost"],
            "range_km": spec["performance"]["range_km"]
        })
    
    # Use upsert for missile types
    for missile_type in missile_types_data:
        await db.missile_types.update_one(
            {"id": missile_type["id"]},
            {"$set": missile_type},
            upsert=True
        )
    
    # Verified strike data based on documented, sourced events
    strikes_data = [
        # ==========================================
        # RUSSIA-UKRAINE WAR - Verified Major Strikes
        # ==========================================
        {"id": "ru-ua-001", "conflict_id": "russia-ukraine", "date": "2022-02-24", "location": "Kyiv", "country": "Ukraine", "latitude": 50.4501, "longitude": 30.5234, "missile_type": "Kalibr", "missile_cost": 1500000, "launch_location": "Black Sea Fleet", "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 137, "deceased": 57, "description": "First day of invasion - multiple missile strikes on Kyiv military targets"},
        {"id": "ru-ua-002", "conflict_id": "russia-ukraine", "date": "2022-03-16", "location": "Mariupol", "country": "Ukraine", "latitude": 47.0971, "longitude": 37.5432, "missile_type": "Kalibr", "missile_cost": 1500000, "launch_location": "Black Sea Fleet", "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 600, "deceased": 300, "description": "Strike on Mariupol Drama Theatre sheltering civilians - verified by AP"},
        {"id": "ru-ua-003", "conflict_id": "russia-ukraine", "date": "2022-10-10", "location": "Kyiv", "country": "Ukraine", "latitude": 50.4501, "longitude": 30.5234, "missile_type": "Kh-101", "missile_cost": 7500000, "launch_location": "Tu-95MS from Engels Air Base", "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 65, "deceased": 3, "description": "Massive barrage - 84 cruise missiles + 24 drones across multiple cities"},
        {"id": "ru-ua-004", "conflict_id": "russia-ukraine", "date": "2023-01-14", "location": "Dnipro", "country": "Ukraine", "latitude": 48.4647, "longitude": 35.0462, "missile_type": "Kh-22", "missile_cost": 1000000, "launch_location": "Tu-22M3 strategic bomber", "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 126, "deceased": 46, "description": "Kh-22 hit 9-story residential building - 46 killed including 6 children, 236 apartments destroyed"},
        {"id": "ru-ua-005", "conflict_id": "russia-ukraine", "date": "2023-05-04", "location": "Kyiv", "country": "Ukraine", "latitude": 50.4501, "longitude": 30.5234, "missile_type": "Kinzhal", "missile_cost": 12000000, "launch_location": "MiG-31K from Astrakhan", "intercepted": True, "interceptor_type": "Patriot PAC-3 MSE", "interceptor_cost": 4000000, "interception_location": "Kyiv Oblast airspace", "casualties": 0, "deceased": 0, "description": "First confirmed Kinzhal interception by Patriot system - historic milestone"},
        {"id": "ru-ua-006", "conflict_id": "russia-ukraine", "date": "2023-12-29", "location": "Kyiv", "country": "Ukraine", "latitude": 50.4501, "longitude": 30.5234, "missile_type": "Kh-101", "missile_cost": 7500000, "launch_location": "Tu-95MS strategic bombers", "intercepted": True, "interceptor_type": "Patriot PAC-3 MSE", "interceptor_cost": 4000000, "interception_location": "Kyiv Oblast", "casualties": 2, "deceased": 2, "description": "69 cruise missiles launched - 54 intercepted (78% rate), strikes hit Kharkiv"},
        {"id": "ru-ua-007", "conflict_id": "russia-ukraine", "date": "2024-03-02", "location": "Odesa", "country": "Ukraine", "latitude": 46.4825, "longitude": 30.7233, "missile_type": "Shahed-136", "missile_cost": 50000, "launch_location": "Occupied Crimea", "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 21, "deceased": 12, "description": "Drone strike hit residential building - 12 killed including 5 children"},
        {"id": "ru-ua-008", "conflict_id": "russia-ukraine", "date": "2024-03-15", "location": "Odesa", "country": "Ukraine", "latitude": 46.4825, "longitude": 30.7233, "missile_type": "Iskander-M", "missile_cost": 3000000, "launch_location": "Crimea", "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 94, "deceased": 21, "description": "Ballistic missile strike - 21 killed, 73+ injured"},
        {"id": "ru-ua-009", "conflict_id": "russia-ukraine", "date": "2024-08-26", "location": "Kharkiv", "country": "Ukraine", "latitude": 49.9935, "longitude": 36.2304, "missile_type": "Kh-101", "missile_cost": 7500000, "launch_location": "Tu-95MS bombers", "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 150, "deceased": 7, "description": "Largest 2024 attack - 100+ missiles, 100+ drones across Kyiv, Kharkiv, Dnipro, Odesa"},
        {"id": "ru-ua-010", "conflict_id": "russia-ukraine", "date": "2024-11-18", "location": "Odesa", "country": "Ukraine", "latitude": 46.4825, "longitude": 30.7233, "missile_type": "Kalibr", "missile_cost": 1500000, "launch_location": "Black Sea Fleet", "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 49, "deceased": 10, "description": "Port city strike - 10 killed, 39 injured"},
        {"id": "ru-ua-011", "conflict_id": "russia-ukraine", "date": "2026-02-15", "location": "Zaporizhzhia", "country": "Ukraine", "latitude": 47.8388, "longitude": 35.1396, "missile_type": "Iskander-M", "missile_cost": 3000000, "launch_location": "Occupied territories", "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 45, "deceased": 12, "description": "Energy infrastructure campaign - Feb 2026 saw 288 missiles (113% increase from January)"},
        {"id": "ru-ua-012", "conflict_id": "russia-ukraine", "date": "2026-03-24", "location": "Kyiv", "country": "Ukraine", "latitude": 50.4501, "longitude": 30.5234, "missile_type": "Shahed-136", "missile_cost": 50000, "launch_location": "Multiple launch sites", "intercepted": True, "interceptor_type": "NASAMS", "interceptor_cost": 500000, "interception_location": "Kyiv Oblast", "casualties": 0, "deceased": 0, "description": "Largest single barrage since war began - 948 drones + 30 missiles in 24 hours"},

        # ==========================================
        # ISRAEL-HAMAS CONFLICT - Verified Events
        # ==========================================
        {"id": "il-ha-001", "conflict_id": "israel-hamas", "date": "2023-10-07", "location": "Sderot", "country": "Israel", "latitude": 31.5240, "longitude": 34.5964, "missile_type": "Qassam-3", "missile_cost": 500, "launch_location": "Northern Gaza Strip", "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 1195, "deceased": 1195, "description": "October 7 Hamas attack - 3,000-5,000 rockets in first hours, 1,195 Israelis killed"},
        {"id": "il-ha-002", "conflict_id": "israel-hamas", "date": "2023-10-08", "location": "Ashkelon", "country": "Israel", "latitude": 31.6688, "longitude": 34.5742, "missile_type": "Qassam-3", "missile_cost": 500, "launch_location": "Central Gaza", "intercepted": True, "interceptor_type": "Iron Dome Tamir", "interceptor_cost": 50000, "interception_location": "Ashkelon airspace", "casualties": 0, "deceased": 0, "description": "Iron Dome intercepts mass rocket barrage - 97% success rate"},
        {"id": "il-ha-003", "conflict_id": "israel-hamas", "date": "2023-10-23", "location": "Khan Younis", "country": "Gaza", "latitude": 31.3462, "longitude": 34.3015, "missile_type": "JDAM", "missile_cost": 25000, "launch_location": "Israeli Air Force", "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 436, "deceased": 436, "description": "Israeli airstrikes on Khan Younis and Al-Shati - 436 killed in one night"},
        {"id": "il-ha-004", "conflict_id": "israel-hamas", "date": "2023-10-31", "location": "Jabalia", "country": "Gaza", "latitude": 31.5281, "longitude": 34.4831, "missile_type": "GBU-31", "missile_cost": 30000, "launch_location": "Israeli Air Force", "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 195, "deceased": 126, "description": "Jabalia refugee camp strike - 126+ killed including 69 children"},
        {"id": "il-ha-005", "conflict_id": "israel-hamas", "date": "2023-11-20", "location": "Tel Aviv", "country": "Israel", "latitude": 32.0853, "longitude": 34.7818, "missile_type": "M-75", "missile_cost": 2000, "launch_location": "Gaza City", "intercepted": True, "interceptor_type": "Iron Dome Tamir", "interceptor_cost": 50000, "interception_location": "Central Israel airspace", "casualties": 0, "deceased": 0, "description": "Medium-range rocket intercepted over Tel Aviv"},
        {"id": "il-ha-006", "conflict_id": "israel-hamas", "date": "2024-01-01", "location": "Beersheba", "country": "Israel", "latitude": 31.2530, "longitude": 34.7915, "missile_type": "Qassam-3", "missile_cost": 500, "launch_location": "Khan Younis, Gaza", "intercepted": True, "interceptor_type": "Iron Dome Tamir", "interceptor_cost": 50000, "interception_location": "Negev airspace", "casualties": 0, "deceased": 0, "description": "New Year barrage - 20+ rockets sent millions to shelters"},
        {"id": "il-ha-007", "conflict_id": "israel-hamas", "date": "2024-07-01", "location": "Netivot", "country": "Israel", "latitude": 31.4190, "longitude": 34.5958, "missile_type": "Qassam-3", "missile_cost": 500, "launch_location": "Southern Gaza", "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 6, "deceased": 2, "description": "Border communities barrage - largest in 7 months at that time"},
        {"id": "il-ha-008", "conflict_id": "israel-hamas", "date": "2024-08-10", "location": "Gaza City", "country": "Gaza", "latitude": 31.5017, "longitude": 34.4668, "missile_type": "GBU-28", "missile_cost": 150000, "launch_location": "Israeli Air Force", "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 100, "deceased": 77, "description": "Israeli strike on Al-Tabi'een school compound - 77+ civilians killed"},
        {"id": "il-ha-009", "conflict_id": "israel-hamas", "date": "2025-04-06", "location": "Ashkelon", "country": "Israel", "latitude": 31.6688, "longitude": 34.5742, "missile_type": "Qassam-3", "missile_cost": 500, "launch_location": "Gaza Strip", "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 3, "deceased": 0, "description": "10 rockets fired - largest barrage in months, one hit Ashkelon despite Iron Dome"},
        {"id": "il-ha-010", "conflict_id": "israel-hamas", "date": "2025-10-19", "location": "Al-Bureij", "country": "Gaza", "latitude": 31.4548, "longitude": 34.3742, "missile_type": "JDAM", "missile_cost": 25000, "launch_location": "Israeli Air Force", "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 11, "deceased": 11, "description": "Post-ceasefire strike - 11 killed including 8 children and 2 women"},

        # ==========================================
        # IRAN-ISRAEL DIRECT CONFLICT - Verified Events
        # ==========================================

        # April 2024 - Operation True Promise (Iran → Israel)
        {"id": "ir-il-001", "conflict_id": "iran-israel", "date": "2024-04-13", "location": "Nevatim AFB", "country": "Israel", "latitude": 31.2085, "longitude": 34.9218, "missile_type": "Fateh-110", "missile_cost": 150000, "launch_location": "Western Iran", "intercepted": True, "interceptor_type": "Arrow 3", "interceptor_cost": 3000000, "interception_location": "Exo-atmospheric over Jordan", "casualties": 32, "deceased": 0, "description": "Operation True Promise - 170 drones, 30+ cruise missiles, 120+ ballistic missiles - 99% intercepted by Arrow 3, David's Sling, Iron Dome + US/UK/France/Jordan coalition"},

        # October 2024 - Second Iranian attack (Iran → Israel)
        {"id": "ir-il-002", "conflict_id": "iran-israel", "date": "2024-10-01", "location": "Nevatim AFB", "country": "Israel", "latitude": 31.2085, "longitude": 34.9218, "missile_type": "Fattah", "missile_cost": 500000, "launch_location": "Iran", "intercepted": True, "interceptor_type": "Arrow 3", "interceptor_cost": 3000000, "interception_location": "Israeli airspace", "casualties": 0, "deceased": 0, "description": "180-200 ballistic missiles including hypersonic Fattah - 99% intercepted, minor damage to Nevatim Airbase"},

        # September 2024 - Israeli strike killing Nasrallah (Israel → Lebanon)
        {"id": "ir-il-003", "conflict_id": "iran-israel", "date": "2024-09-27", "location": "Dahieh, Beirut", "country": "Lebanon", "latitude": 33.8547, "longitude": 35.5097, "missile_type": "GBU-28", "missile_cost": 150000, "launch_location": "Israeli Air Force", "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 228, "deceased": 33, "description": "Assassination of Hezbollah Secretary-General Hassan Nasrallah - 80+ bombs on underground HQ"},

        # September 23, 2024 - Deadliest day in Lebanon (Israel → Lebanon)
        {"id": "ir-il-004", "conflict_id": "iran-israel", "date": "2024-09-23", "location": "Beirut", "country": "Lebanon", "latitude": 33.8938, "longitude": 35.5018, "missile_type": "JDAM", "missile_cost": 25000, "launch_location": "Israeli Air Force", "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 569, "deceased": 569, "description": "Deadliest day for Lebanon in decades - 569 killed including 50 children and 94 women"},

        # Israel → Lebanon verified strikes
        {"id": "ir-il-005", "conflict_id": "iran-israel", "date": "2024-10-01", "location": "Beirut", "country": "Lebanon", "latitude": 33.8938, "longitude": 35.5018, "missile_type": "GBU-28", "missile_cost": 150000, "launch_location": "Israeli Air Force", "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 200, "deceased": 85, "description": "Israeli ground invasion of Lebanon begins - strikes on Hezbollah HQ"},
        {"id": "ir-il-006", "conflict_id": "iran-israel", "date": "2024-10-08", "location": "Tyre", "country": "Lebanon", "latitude": 33.2705, "longitude": 35.1965, "missile_type": "GBU-31", "missile_cost": 30000, "launch_location": "Israeli Air Force", "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 180, "deceased": 42, "description": "Coastal city strikes during invasion campaign"},
        {"id": "ir-il-007", "conflict_id": "iran-israel", "date": "2024-10-15", "location": "Baalbek", "country": "Lebanon", "latitude": 34.0047, "longitude": 36.2110, "missile_type": "GBU-28", "missile_cost": 150000, "launch_location": "Israeli Air Force", "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 210, "deceased": 55, "description": "Bekaa Valley Hezbollah base strikes"},
        {"id": "ir-il-008", "conflict_id": "iran-israel", "date": "2024-11-01", "location": "Nabatieh", "country": "Lebanon", "latitude": 33.3772, "longitude": 35.4839, "missile_type": "JDAM", "missile_cost": 25000, "launch_location": "Israeli Air Force", "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 125, "deceased": 32, "description": "Southern Lebanon strikes before Nov 27 ceasefire"},

        # Hezbollah → Israel attacks (verified)
        {"id": "ir-il-009", "conflict_id": "iran-israel", "date": "2024-09-22", "location": "Nazareth", "country": "Israel", "latitude": 32.6996, "longitude": 35.3035, "missile_type": "Fajr-5", "missile_cost": 50000, "launch_location": "Southern Lebanon", "intercepted": True, "interceptor_type": "Iron Dome Tamir", "interceptor_cost": 50000, "interception_location": "Northern Israel airspace", "casualties": 0, "deceased": 0, "description": "Hezbollah rocket attacks on northern cities including Nazareth"},
        {"id": "ir-il-010", "conflict_id": "iran-israel", "date": "2024-10-29", "location": "Tarshiha", "country": "Israel", "latitude": 33.0139, "longitude": 35.2733, "missile_type": "Katyusha", "missile_cost": 1000, "launch_location": "Southern Lebanon", "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 1, "deceased": 1, "description": "Rocket hit house - one civilian killed (Mohammed Naim, 23)"},
        {"id": "ir-il-011", "conflict_id": "iran-israel", "date": "2024-10-31", "location": "Tarshiha", "country": "Israel", "latitude": 33.0139, "longitude": 35.2733, "missile_type": "Fajr-5", "missile_cost": 50000, "launch_location": "Southern Lebanon", "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 5, "deceased": 5, "description": "Rocket salvos at Karmiel, Acre, Haifa suburbs - 5 killed in Tarshiha"},

        # Twelve-Day War - June 13-24, 2025
        # Israeli strikes on Iran
        {"id": "ir-il-012", "conflict_id": "iran-israel", "date": "2025-06-13", "location": "Natanz", "country": "Iran", "latitude": 33.7225, "longitude": 51.7266, "missile_type": "GBU-28", "missile_cost": 150000, "launch_location": "Israeli Air Force - 200+ jets", "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 200, "deceased": 80, "description": "12-Day War begins - 5 waves of airstrikes, 330+ munitions on ~100 targets including Natanz nuclear facility"},
        {"id": "ir-il-013", "conflict_id": "iran-israel", "date": "2025-06-14", "location": "Isfahan", "country": "Iran", "latitude": 32.6546, "longitude": 51.6680, "missile_type": "GBU-28", "missile_cost": 150000, "launch_location": "Israeli Air Force", "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 150, "deceased": 55, "description": "Nuclear facility and military base strikes in Isfahan"},
        {"id": "ir-il-014", "conflict_id": "iran-israel", "date": "2025-06-15", "location": "Tehran", "country": "Iran", "latitude": 35.6892, "longitude": 51.3890, "missile_type": "JDAM", "missile_cost": 25000, "launch_location": "Israeli Air Force", "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 300, "deceased": 120, "description": "Strikes on military HQ and infrastructure in Tehran"},

        # Iranian retaliation during 12-Day War
        {"id": "ir-il-015", "conflict_id": "iran-israel", "date": "2025-06-14", "location": "Tel Aviv", "country": "Israel", "latitude": 32.0853, "longitude": 34.7818, "missile_type": "Fateh-110", "missile_cost": 150000, "launch_location": "Western Iran", "intercepted": True, "interceptor_type": "Arrow 3", "interceptor_cost": 3000000, "interception_location": "Israeli airspace", "casualties": 29, "deceased": 29, "description": "Iran fires 550+ ballistic missiles + 1,000+ drones - 28 Israeli civilians and 1 soldier killed, ~90% intercepted"},

        # US involvement - June 22
        {"id": "ir-il-016", "conflict_id": "iran-israel", "date": "2025-06-22", "location": "Fordow", "country": "Iran", "latitude": 34.8827, "longitude": 51.2592, "missile_type": "GBU-57", "missile_cost": 3500000, "launch_location": "US Air Force B-2 bombers", "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 100, "deceased": 40, "description": "US bunker-buster strikes on Fordow, Natanz, Isfahan nuclear facilities"},

        # Operation Epic Fury / Operation Roaring Lion - Feb 28, 2026+
        {"id": "ir-il-017", "conflict_id": "iran-israel", "date": "2026-02-28", "location": "Tehran", "country": "Iran", "latitude": 35.6892, "longitude": 51.3890, "missile_type": "GBU-28", "missile_cost": 150000, "launch_location": "US/Israeli joint operation", "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 4000, "deceased": 1500, "description": "Operation Epic Fury begins - nearly 900 strikes in first 12 hours, Supreme Leader Khamenei killed"},
        {"id": "ir-il-018", "conflict_id": "iran-israel", "date": "2026-02-28", "location": "Isfahan", "country": "Iran", "latitude": 32.6546, "longitude": 51.6680, "missile_type": "GBU-57", "missile_cost": 3500000, "launch_location": "US Air Force", "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 200, "deceased": 80, "description": "Nuclear program targets - Karaj, Kermanshah, Isfahan struck"},
        {"id": "ir-il-019", "conflict_id": "iran-israel", "date": "2026-02-28", "location": "Qom", "country": "Iran", "latitude": 34.6401, "longitude": 50.8764, "missile_type": "JDAM", "missile_cost": 25000, "launch_location": "US/Israeli Air Forces", "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 150, "deceased": 60, "description": "Military and leadership targets in Qom"},
        {"id": "ir-il-020", "conflict_id": "iran-israel", "date": "2026-02-28", "location": "Tabriz", "country": "Iran", "latitude": 38.0800, "longitude": 46.2919, "missile_type": "GBU-31", "missile_cost": 30000, "launch_location": "Israeli Air Force", "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 100, "deceased": 40, "description": "Missile production and military infrastructure"},

        # Iranian retaliation on Gulf states - March 2026
        {"id": "ir-il-021", "conflict_id": "iran-israel", "date": "2026-03-01", "location": "Dubai", "country": "UAE", "latitude": 25.2048, "longitude": 55.2708, "missile_type": "Shahed-136", "missile_cost": 50000, "launch_location": "Iran", "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 74, "deceased": 8, "description": "21 drones struck civilian targets including hotels - 8 killed, 68 injured"},
        {"id": "ir-il-022", "conflict_id": "iran-israel", "date": "2026-03-01", "location": "Al Dhafra AFB", "country": "UAE", "latitude": 24.2500, "longitude": 54.5500, "missile_type": "Fateh-110", "missile_cost": 150000, "launch_location": "Iran", "intercepted": True, "interceptor_type": "THAAD", "interceptor_cost": 12700000, "interception_location": "UAE airspace", "casualties": 3, "deceased": 3, "description": "UAE intercepted 398 ballistic missiles + 1,872 drones - Al Dhafra Air Base targeted"},
        {"id": "ir-il-023", "conflict_id": "iran-israel", "date": "2026-03-01", "location": "Ras Tanura", "country": "Saudi Arabia", "latitude": 26.6500, "longitude": 50.1500, "missile_type": "Shahed-136", "missile_cost": 50000, "launch_location": "Iran", "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 2, "deceased": 2, "description": "Iranian strikes on Saudi Aramco facility - 38 missiles and 435 drones hit Saudi Arabia"},
        {"id": "ir-il-024", "conflict_id": "iran-israel", "date": "2026-03-02", "location": "Al Udeid AFB", "country": "Qatar", "latitude": 25.1173, "longitude": 51.3150, "missile_type": "Shahab-3", "missile_cost": 800000, "launch_location": "Iran", "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 20, "deceased": 5, "description": "US base Al Udeid targeted - Iran fired missiles at largest US Middle East base"},

        # March 2026 Lebanon escalation
        {"id": "ir-il-025", "conflict_id": "iran-israel", "date": "2026-03-02", "location": "Beirut", "country": "Lebanon", "latitude": 33.8938, "longitude": 35.5018, "missile_type": "GBU-28", "missile_cost": 150000, "launch_location": "Israeli Air Force", "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 200, "deceased": 80, "description": "Ceasefire collapses - Hezbollah attacks Israel, Israel escalates across Lebanon"},
        {"id": "ir-il-026", "conflict_id": "iran-israel", "date": "2026-03-07", "location": "Bekaa Valley", "country": "Lebanon", "latitude": 33.8463, "longitude": 35.9020, "missile_type": "GBU-31", "missile_cost": 30000, "launch_location": "Israeli Air Force", "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 41, "deceased": 41, "description": "41+ killed in Israeli air attacks on Bekaa Valley"},
        {"id": "ir-il-027", "conflict_id": "iran-israel", "date": "2026-03-16", "location": "Southern Lebanon", "country": "Lebanon", "latitude": 33.2705, "longitude": 35.1965, "missile_type": "JDAM", "missile_cost": 25000, "launch_location": "Israeli ground forces", "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 300, "deceased": 100, "description": "Israeli ground invasion of southern Lebanon begins - Division 162 moves to Litani River"},

        # ── April 2026 Lebanon escalation ──────────────────────────────────
        {"id": "ir-il-028", "conflict_id": "iran-israel", "date": "2026-04-01", "location": "Beirut", "country": "Lebanon", "latitude": 33.8938, "longitude": 35.5018, "missile_type": "GBU-28", "missile_cost": 150000, "launch_location": "Israeli Air Force", "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 180, "deceased": 65, "description": "Israeli strikes on Beirut southern suburbs - Hezbollah command infrastructure targeted"},
        {"id": "ir-il-029", "conflict_id": "iran-israel", "date": "2026-04-03", "location": "Tyre", "country": "Lebanon", "latitude": 33.2705, "longitude": 35.1965, "missile_type": "JDAM", "missile_cost": 25000, "launch_location": "Israeli Air Force", "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 95, "deceased": 38, "description": "Coastal city strikes — 38 killed including women and children"},
        {"id": "ir-il-030", "conflict_id": "iran-israel", "date": "2026-04-05", "location": "Bekaa Valley", "country": "Lebanon", "latitude": 33.8463, "longitude": 35.9020, "missile_type": "GBU-31", "missile_cost": 30000, "launch_location": "Israeli Air Force", "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 120, "deceased": 44, "description": "Bekaa Valley weapons depots and Hezbollah logistics routes struck"},
        {"id": "ir-il-031", "conflict_id": "iran-israel", "date": "2026-04-08", "location": "Beirut", "country": "Lebanon", "latitude": 33.8938, "longitude": 35.5018, "missile_type": "GBU-28", "missile_cost": 150000, "launch_location": "Israeli Air Force", "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 410, "deceased": 160, "description": "Largest single-day Lebanon attack — 160 missiles launched against 100 targets across Beirut, Tyre, Sidon and Bekaa Valley. Mass civilian infrastructure destroyed."},
        {"id": "ir-il-032", "conflict_id": "iran-israel", "date": "2026-04-08", "location": "Sidon", "country": "Lebanon", "latitude": 33.5633, "longitude": 35.3708, "missile_type": "JDAM", "missile_cost": 25000, "launch_location": "Israeli Air Force", "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 85, "deceased": 30, "description": "Sidon struck as part of April 8 coordinated 100-target barrage"},
        {"id": "ir-il-033", "conflict_id": "iran-israel", "date": "2026-04-08", "location": "Southern Lebanon", "country": "Lebanon", "latitude": 33.2705, "longitude": 35.1965, "missile_type": "GBU-31", "missile_cost": 30000, "launch_location": "Israeli Air Force", "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 140, "deceased": 52, "description": "Southern Lebanon ground targets struck simultaneously during April 8 mass barrage"},

        # Hezbollah retaliatory fire — April 2026
        {"id": "ir-il-034", "conflict_id": "iran-israel", "date": "2026-04-08", "location": "Haifa", "country": "Israel", "latitude": 32.7940, "longitude": 34.9896, "missile_type": "Fajr-5", "missile_cost": 50000, "launch_location": "Southern Lebanon", "intercepted": True, "interceptor_type": "Iron Dome Tamir", "interceptor_cost": 50000, "interception_location": "Northern Israel airspace", "casualties": 12, "deceased": 4, "description": "Hezbollah retaliatory barrage on Haifa after April 8 strikes — 4 killed despite Iron Dome interceptions"},
        {"id": "ir-il-035", "conflict_id": "iran-israel", "date": "2026-04-09", "location": "Nahariya", "country": "Israel", "latitude": 33.0070, "longitude": 35.0942, "missile_type": "Katyusha", "missile_cost": 1000, "launch_location": "Southern Lebanon", "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 18, "deceased": 6, "description": "Rocket fire on northern Israel cities continues following Lebanon mass strikes"}
    ]
    
    # Use upsert for strikes
    for strike in strikes_data:
        await db.strikes.update_one(
            {"id": strike["id"]},
            {"$set": strike},
            upsert=True
        )
    
    logger.info(f"Database initialized with {len(conflicts_data)} conflicts, {len(missile_types_data)} missile types, and {len(strikes_data)} strikes")
    
    # Start background update task
    asyncio.create_task(periodic_update_task(db, interval_hours=1))
    logger.info("Started automatic hourly data update task")

    # Start real-time OSINT strike ingestion (runs every hour)
    strike_ingester = RealTimeStrikeIngester(db)
    asyncio.create_task(run_hourly_ingestion())
    logger.info("Started real-time OSINT strike ingestion task (runs every 60 min)")