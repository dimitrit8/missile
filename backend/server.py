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

# Admin password for analytics dashboard
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'missile2024admin')

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
    intercepted: bool
    interceptor_type: Optional[str] = None
    interceptor_cost: Optional[float] = None
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
        "recent_visitors": recent
    }

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

# Initialize database with data on startup
@app.on_event("startup")
async def initialize_database():
    # Create unique indexes to prevent duplicates
    await db.conflicts.create_index("id", unique=True)
    await db.missile_types.create_index("id", unique=True)
    await db.strikes.create_index("id", unique=True)
    
    logger.info("Initializing/updating database with missile strike data...")
    
    # Force refresh conflicts with accurate researched data
    await db.conflicts.delete_many({})
    
    # ALWAYS update conflicts with the latest researched data
    conflicts_data = [
        {
            "id": "russia-ukraine",
            "name": "Russia-Ukraine War",
            "regions": ["Ukraine", "Russia"],
            "start_date": "2022-02-24",
            "end_date": None,
            "total_missiles": 11466,
            "total_intercepted": 9574,
            "total_casualties": 541783,
            "total_deceased": 13000,
            "total_cost": 28665000000.0
        },
        {
            "id": "israel-hamas",
            "name": "Israel-Hamas Conflict",
            "regions": ["Israel", "Gaza"],
            "start_date": "2023-10-07",
            "end_date": None,
            "total_missiles": 13200,
            "total_intercepted": 11880,
            "total_casualties": 45000,
            "total_deceased": 5000,
            "total_cost": 10560000.0
        },
        {
            "id": "iran-israel",
            "name": "Iran-Israel-Lebanon War",
            "regions": ["Iran", "Israel", "Lebanon", "UAE", "Saudi Arabia", "Qatar"],
            "start_date": "2024-04-13",
            "end_date": None,
            "total_missiles": 5765,
            "total_intercepted": 4900,
            "total_casualties": 15438,
            "total_deceased": 2118,
            "total_cost": 4760000000.0
        }
    ]
    
    # Upsert conflicts
    for conflict in conflicts_data:
        await db.conflicts.update_one(
            {"id": conflict["id"]},
            {"$set": conflict},
            upsert=True
        )
    
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
    
    # Insert sample strikes data (representative strikes from each conflict)
    strikes_data = [
        # Russia-Ukraine strikes
        {"id": "ru-ua-001", "conflict_id": "russia-ukraine", "date": "2022-02-24", "location": "Kyiv", "country": "Ukraine", "latitude": 50.4501, "longitude": 30.5234, "missile_type": "Kalibr", "missile_cost": 2200000, "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 25, "deceased": 8, "description": "Strike on military facility"},
        {"id": "ru-ua-002", "conflict_id": "russia-ukraine", "date": "2022-03-15", "location": "Kharkiv", "country": "Ukraine", "latitude": 49.9935, "longitude": 36.2304, "missile_type": "Iskander", "missile_cost": 1500000, "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 42, "deceased": 15, "description": "Residential area strike"},
        {"id": "ru-ua-003", "conflict_id": "russia-ukraine", "date": "2023-05-10", "location": "Dnipro", "country": "Ukraine", "latitude": 48.4647, "longitude": 35.0462, "missile_type": "Kinzhal", "missile_cost": 2500000, "intercepted": True, "interceptor_type": "Patriot PAC-3", "interceptor_cost": 4000000, "casualties": 0, "deceased": 0, "description": "Intercepted hypersonic missile"},
        {"id": "ru-ua-004", "conflict_id": "russia-ukraine", "date": "2024-01-20", "location": "Odesa", "country": "Ukraine", "latitude": 46.4825, "longitude": 30.7233, "missile_type": "Kh-101", "missile_cost": 1100000, "intercepted": True, "interceptor_type": "Patriot PAC-3", "interceptor_cost": 4000000, "casualties": 0, "deceased": 0, "description": "Port infrastructure target"},
        {"id": "ru-ua-005", "conflict_id": "russia-ukraine", "date": "2024-11-18", "location": "Lviv", "country": "Ukraine", "latitude": 49.8397, "longitude": 24.0297, "missile_type": "Shahed-136", "missile_cost": 50000, "intercepted": True, "interceptor_type": "Patriot PAC-3", "interceptor_cost": 4000000, "casualties": 0, "deceased": 0, "description": "Drone swarm attack"},
        {"id": "ru-ua-006", "conflict_id": "russia-ukraine", "date": "2025-02-10", "location": "Zaporizhzhia", "country": "Ukraine", "latitude": 47.8388, "longitude": 35.1396, "missile_type": "Iskander", "missile_cost": 1500000, "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 18, "deceased": 6, "description": "Energy infrastructure"},
        {"id": "ru-ua-007", "conflict_id": "russia-ukraine", "date": "2025-08-05", "location": "Mariupol", "country": "Ukraine", "latitude": 47.0971, "longitude": 37.5432, "missile_type": "Kalibr", "missile_cost": 2200000, "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 65, "deceased": 22, "description": "Civilian building strike"},
        {"id": "ru-ua-008", "conflict_id": "russia-ukraine", "date": "2026-01-12", "location": "Poltava", "country": "Ukraine", "latitude": 49.5883, "longitude": 34.5514, "missile_type": "Kh-101", "missile_cost": 1100000, "intercepted": True, "interceptor_type": "Patriot PAC-3", "interceptor_cost": 4000000, "casualties": 0, "deceased": 0, "description": "Intercepted cruise missile"},
        {"id": "ru-ua-009", "conflict_id": "russia-ukraine", "date": "2026-02-28", "location": "Sumy", "country": "Ukraine", "latitude": 50.9077, "longitude": 34.7981, "missile_type": "Shahed-136", "missile_cost": 50000, "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 8, "deceased": 3, "description": "Drone strike on infrastructure"},
        {"id": "ru-ua-010", "conflict_id": "russia-ukraine", "date": "2026-03-15", "location": "Chernihiv", "country": "Ukraine", "latitude": 51.4982, "longitude": 31.2893, "missile_type": "Iskander", "missile_cost": 1500000, "intercepted": True, "interceptor_type": "Patriot PAC-3", "interceptor_cost": 4000000, "casualties": 0, "deceased": 0, "description": "Military base target"},
        
        # Israel-Hamas strikes
        {"id": "il-ha-001", "conflict_id": "israel-hamas", "date": "2023-10-07", "location": "Sderot", "country": "Israel", "latitude": 31.5240, "longitude": 34.5964, "missile_type": "Qassam", "missile_cost": 800, "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 12, "deceased": 5, "description": "Rocket attack on town"},
        {"id": "il-ha-002", "conflict_id": "israel-hamas", "date": "2023-10-08", "location": "Ashkelon", "country": "Israel", "latitude": 31.6688, "longitude": 34.5742, "missile_type": "Qassam", "missile_cost": 800, "intercepted": True, "interceptor_type": "Iron Dome Tamir", "interceptor_cost": 75000, "casualties": 0, "deceased": 0, "description": "Intercepted rocket barrage"},
        {"id": "il-ha-003", "conflict_id": "israel-hamas", "date": "2023-11-20", "location": "Tel Aviv", "country": "Israel", "latitude": 32.0853, "longitude": 34.7818, "missile_type": "Qassam", "missile_cost": 800, "intercepted": True, "interceptor_type": "Iron Dome Tamir", "interceptor_cost": 75000, "casualties": 0, "deceased": 0, "description": "Rocket intercepted over city"},
        {"id": "il-ha-004", "conflict_id": "israel-hamas", "date": "2024-01-15", "location": "Beersheba", "country": "Israel", "latitude": 31.2530, "longitude": 34.7915, "missile_type": "Qassam", "missile_cost": 800, "intercepted": True, "interceptor_type": "Iron Dome Tamir", "interceptor_cost": 75000, "casualties": 0, "deceased": 0, "description": "Mass rocket attack"},
        {"id": "il-ha-005", "conflict_id": "israel-hamas", "date": "2024-05-22", "location": "Netivot", "country": "Israel", "latitude": 31.4190, "longitude": 34.5958, "missile_type": "Qassam", "missile_cost": 800, "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 6, "deceased": 2, "description": "Residential area hit"},
        {"id": "il-ha-006", "conflict_id": "israel-hamas", "date": "2024-09-10", "location": "Kiryat Gat", "country": "Israel", "latitude": 31.6100, "longitude": 34.7642, "missile_type": "Qassam", "missile_cost": 800, "intercepted": True, "interceptor_type": "Iron Dome Tamir", "interceptor_cost": 75000, "casualties": 0, "deceased": 0, "description": "Intercepted barrage"},
        {"id": "il-ha-007", "conflict_id": "israel-hamas", "date": "2025-03-18", "location": "Ashdod", "country": "Israel", "latitude": 31.8044, "longitude": 34.6553, "missile_type": "Qassam", "missile_cost": 800, "intercepted": True, "interceptor_type": "Iron Dome Tamir", "interceptor_cost": 75000, "casualties": 0, "deceased": 0, "description": "Rocket attack"},
        {"id": "il-ha-008", "conflict_id": "israel-hamas", "date": "2025-07-05", "location": "Ofakim", "country": "Israel", "latitude": 31.3181, "longitude": 34.6197, "missile_type": "Qassam", "missile_cost": 800, "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 3, "deceased": 1, "description": "Direct hit on building"},
        {"id": "il-ha-009", "conflict_id": "israel-hamas", "date": "2025-11-28", "location": "Dimona", "country": "Israel", "latitude": 31.0698, "longitude": 35.0330, "missile_type": "Qassam", "missile_cost": 800, "intercepted": True, "interceptor_type": "Iron Dome Tamir", "interceptor_cost": 75000, "casualties": 0, "deceased": 0, "description": "Rocket interception"},
        {"id": "il-ha-010", "conflict_id": "israel-hamas", "date": "2026-02-14", "location": "Sderot", "country": "Israel", "latitude": 31.5240, "longitude": 34.5964, "missile_type": "Qassam", "missile_cost": 800, "intercepted": True, "interceptor_type": "Iron Dome Tamir", "interceptor_cost": 75000, "casualties": 0, "deceased": 0, "description": "Defensive success"},
        
        # Iran-Israel strikes - Including Iran, UAE, Saudi Arabia, Qatar
        # Israel strikes
        {"id": "ir-il-001", "conflict_id": "iran-israel", "date": "2024-04-13", "location": "Tel Aviv", "country": "Israel", "latitude": 32.0853, "longitude": 34.7818, "missile_type": "Fateh-110", "missile_cost": 1000000, "intercepted": True, "interceptor_type": "Arrow 3", "interceptor_cost": 3500000, "casualties": 0, "deceased": 0, "description": "April 2024 Iranian attack - intercepted"},
        {"id": "ir-il-002", "conflict_id": "iran-israel", "date": "2024-10-01", "location": "Haifa", "country": "Israel", "latitude": 32.7940, "longitude": 34.9896, "missile_type": "Fateh-110", "missile_cost": 1000000, "intercepted": True, "interceptor_type": "Patriot PAC-3", "interceptor_cost": 4000000, "casualties": 0, "deceased": 0, "description": "October 2024 attack - naval port"},
        {"id": "ir-il-003", "conflict_id": "iran-israel", "date": "2025-06-10", "location": "Jerusalem", "country": "Israel", "latitude": 31.7683, "longitude": 35.2137, "missile_type": "Emad", "missile_cost": 1500000, "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 45, "deceased": 8, "description": "12-Day War strike"},
        {"id": "ir-il-004", "conflict_id": "iran-israel", "date": "2025-06-12", "location": "Beersheba", "country": "Israel", "latitude": 31.2530, "longitude": 34.7915, "missile_type": "Shahed-136", "missile_cost": 50000, "intercepted": True, "interceptor_type": "Iron Dome Tamir", "interceptor_cost": 75000, "casualties": 0, "deceased": 0, "description": "Drone swarm intercepted"},
        {"id": "ir-il-005", "conflict_id": "iran-israel", "date": "2025-06-15", "location": "Eilat", "country": "Israel", "latitude": 29.5577, "longitude": 34.9519, "missile_type": "Fateh-110", "missile_cost": 1000000, "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 12, "deceased": 3, "description": "Red Sea port strike"},
        
        # Iran strikes (Israeli retaliation)
        {"id": "ir-il-006", "conflict_id": "iran-israel", "date": "2025-06-11", "location": "Tehran", "country": "Iran", "latitude": 35.6892, "longitude": 51.3890, "missile_type": "JDAM", "missile_cost": 25000, "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 120, "deceased": 45, "description": "Strike on military HQ"},
        {"id": "ir-il-007", "conflict_id": "iran-israel", "date": "2025-06-12", "location": "Isfahan", "country": "Iran", "latitude": 32.6546, "longitude": 51.6680, "missile_type": "GBU-28", "missile_cost": 150000, "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 85, "deceased": 32, "description": "Nuclear facility strike"},
        {"id": "ir-il-008", "conflict_id": "iran-israel", "date": "2025-06-13", "location": "Shiraz", "country": "Iran", "latitude": 29.5918, "longitude": 52.5837, "missile_type": "JDAM", "missile_cost": 25000, "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 65, "deceased": 28, "description": "Air base strike"},
        {"id": "ir-il-009", "conflict_id": "iran-israel", "date": "2025-06-14", "location": "Tabriz", "country": "Iran", "latitude": 38.0800, "longitude": 46.2919, "missile_type": "GBU-31", "missile_cost": 30000, "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 42, "deceased": 18, "description": "Missile production facility"},
        {"id": "ir-il-010", "conflict_id": "iran-israel", "date": "2025-06-16", "location": "Bandar Abbas", "country": "Iran", "latitude": 27.1832, "longitude": 56.2666, "missile_type": "JDAM", "missile_cost": 25000, "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 38, "deceased": 15, "description": "Naval port strike"},
        {"id": "ir-il-011", "conflict_id": "iran-israel", "date": "2025-06-17", "location": "Mashhad", "country": "Iran", "latitude": 36.2972, "longitude": 59.6067, "missile_type": "GBU-28", "missile_cost": 150000, "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 55, "deceased": 22, "description": "Military complex strike"},
        {"id": "ir-il-012", "conflict_id": "iran-israel", "date": "2026-03-01", "location": "Qom", "country": "Iran", "latitude": 34.6401, "longitude": 50.8764, "missile_type": "JDAM", "missile_cost": 25000, "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 72, "deceased": 35, "description": "Operation Epic Fury"},
        {"id": "ir-il-013", "conflict_id": "iran-israel", "date": "2026-03-03", "location": "Kerman", "country": "Iran", "latitude": 30.2839, "longitude": 57.0834, "missile_type": "GBU-31", "missile_cost": 30000, "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 48, "deceased": 19, "description": "Missile storage facility"},
        
        # UAE strikes (Iranian attacks)
        {"id": "ir-il-014", "conflict_id": "iran-israel", "date": "2026-02-28", "location": "Dubai", "country": "UAE", "latitude": 25.2048, "longitude": 55.2708, "missile_type": "Fateh-110", "missile_cost": 1000000, "intercepted": True, "interceptor_type": "THAAD", "interceptor_cost": 12500000, "casualties": 0, "deceased": 0, "description": "Iranian attack on UAE"},
        {"id": "ir-il-015", "conflict_id": "iran-israel", "date": "2026-03-01", "location": "Abu Dhabi", "country": "UAE", "latitude": 24.4539, "longitude": 54.3773, "missile_type": "Emad", "missile_cost": 1500000, "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 85, "deceased": 12, "description": "Strike on capital"},
        {"id": "ir-il-016", "conflict_id": "iran-israel", "date": "2026-03-02", "location": "Al Dhafra AFB", "country": "UAE", "latitude": 24.2500, "longitude": 54.5500, "missile_type": "Shahab-3", "missile_cost": 800000, "intercepted": True, "interceptor_type": "Patriot PAC-3", "interceptor_cost": 4000000, "casualties": 0, "deceased": 0, "description": "Air base attack intercepted"},
        {"id": "ir-il-017", "conflict_id": "iran-israel", "date": "2026-03-05", "location": "Fujairah", "country": "UAE", "latitude": 25.1288, "longitude": 56.3265, "missile_type": "Shahed-136", "missile_cost": 50000, "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 28, "deceased": 5, "description": "Port facility strike"},
        
        # Saudi Arabia strikes (Iranian attacks)
        {"id": "ir-il-018", "conflict_id": "iran-israel", "date": "2026-03-01", "location": "Riyadh", "country": "Saudi Arabia", "latitude": 24.7136, "longitude": 46.6753, "missile_type": "Shahab-3", "missile_cost": 800000, "intercepted": True, "interceptor_type": "Patriot PAC-3", "interceptor_cost": 4000000, "casualties": 0, "deceased": 0, "description": "Capital defense success"},
        {"id": "ir-il-019", "conflict_id": "iran-israel", "date": "2026-03-02", "location": "Dhahran", "country": "Saudi Arabia", "latitude": 26.2743, "longitude": 50.0400, "missile_type": "Fateh-110", "missile_cost": 1000000, "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 52, "deceased": 8, "description": "Oil facility strike"},
        {"id": "ir-il-020", "conflict_id": "iran-israel", "date": "2026-03-04", "location": "Jeddah", "country": "Saudi Arabia", "latitude": 21.4858, "longitude": 39.1925, "missile_type": "Emad", "missile_cost": 1500000, "intercepted": True, "interceptor_type": "THAAD", "interceptor_cost": 12500000, "casualties": 0, "deceased": 0, "description": "Red Sea port defense"},
        {"id": "ir-il-021", "conflict_id": "iran-israel", "date": "2026-03-06", "location": "Dammam", "country": "Saudi Arabia", "latitude": 26.4207, "longitude": 50.0888, "missile_type": "Shahed-136", "missile_cost": 50000, "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 35, "deceased": 6, "description": "Industrial zone strike"},
        
        # Qatar strikes (Iranian attacks)
        {"id": "ir-il-022", "conflict_id": "iran-israel", "date": "2026-03-02", "location": "Doha", "country": "Qatar", "latitude": 25.2854, "longitude": 51.5310, "missile_type": "Fateh-110", "missile_cost": 1000000, "intercepted": True, "interceptor_type": "Patriot PAC-3", "interceptor_cost": 4000000, "casualties": 0, "deceased": 0, "description": "Capital intercepted"},
        {"id": "ir-il-023", "conflict_id": "iran-israel", "date": "2026-03-03", "location": "Al Udeid AFB", "country": "Qatar", "latitude": 25.1173, "longitude": 51.3150, "missile_type": "Shahab-3", "missile_cost": 800000, "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 42, "deceased": 7, "description": "US base strike"},
        {"id": "ir-il-024", "conflict_id": "iran-israel", "date": "2026-03-05", "location": "Ras Laffan", "country": "Qatar", "latitude": 25.9167, "longitude": 51.5333, "missile_type": "Shahed-136", "missile_cost": 50000, "intercepted": True, "interceptor_type": "Iron Dome Tamir", "interceptor_cost": 75000, "casualties": 0, "deceased": 0, "description": "LNG facility defense"},
        
        # Lebanon strikes (Hezbollah-Israel exchanges)
        {"id": "ir-il-025", "conflict_id": "iran-israel", "date": "2024-10-01", "location": "Beirut", "country": "Lebanon", "latitude": 33.8938, "longitude": 35.5018, "missile_type": "GBU-28", "missile_cost": 150000, "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 520, "deceased": 85, "description": "Israeli strike on Hezbollah HQ"},
        {"id": "ir-il-026", "conflict_id": "iran-israel", "date": "2024-10-05", "location": "Dahieh", "country": "Lebanon", "latitude": 33.8547, "longitude": 35.5097, "missile_type": "JDAM", "missile_cost": 25000, "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 340, "deceased": 65, "description": "Southern suburb strikes"},
        {"id": "ir-il-027", "conflict_id": "iran-israel", "date": "2024-10-08", "location": "Tyre", "country": "Lebanon", "latitude": 33.2705, "longitude": 35.1965, "missile_type": "GBU-31", "missile_cost": 30000, "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 180, "deceased": 42, "description": "Coastal city strike"},
        {"id": "ir-il-028", "conflict_id": "iran-israel", "date": "2024-10-12", "location": "Sidon", "country": "Lebanon", "latitude": 33.5571, "longitude": 35.3729, "missile_type": "JDAM", "missile_cost": 25000, "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 145, "deceased": 28, "description": "Port city strike"},
        {"id": "ir-il-029", "conflict_id": "iran-israel", "date": "2024-10-15", "location": "Baalbek", "country": "Lebanon", "latitude": 34.0047, "longitude": 36.2110, "missile_type": "GBU-28", "missile_cost": 150000, "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 210, "deceased": 55, "description": "Bekaa Valley Hezbollah base"},
        {"id": "ir-il-030", "conflict_id": "iran-israel", "date": "2024-11-01", "location": "Nabatieh", "country": "Lebanon", "latitude": 33.3772, "longitude": 35.4839, "missile_type": "JDAM", "missile_cost": 25000, "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 125, "deceased": 32, "description": "Southern Lebanon strike"},
        {"id": "ir-il-031", "conflict_id": "iran-israel", "date": "2024-11-10", "location": "Tripoli", "country": "Lebanon", "latitude": 34.4367, "longitude": 35.8497, "missile_type": "GBU-31", "missile_cost": 30000, "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 95, "deceased": 18, "description": "Northern Lebanon port"},
        {"id": "ir-il-032", "conflict_id": "iran-israel", "date": "2025-01-15", "location": "Jounieh", "country": "Lebanon", "latitude": 33.9808, "longitude": 35.6178, "missile_type": "JDAM", "missile_cost": 25000, "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 78, "deceased": 15, "description": "Coastal resort town"},
        {"id": "ir-il-033", "conflict_id": "iran-israel", "date": "2025-02-20", "location": "Zahle", "country": "Lebanon", "latitude": 33.8463, "longitude": 35.9020, "missile_type": "GBU-28", "missile_cost": 150000, "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 165, "deceased": 38, "description": "Bekaa Valley city strike"},
        {"id": "ir-il-034", "conflict_id": "iran-israel", "date": "2025-03-10", "location": "Bint Jbeil", "country": "Lebanon", "latitude": 33.1214, "longitude": 35.4333, "missile_type": "JDAM", "missile_cost": 25000, "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 88, "deceased": 22, "description": "Border town strike"},
        
        # Hezbollah attacks on Israel (from Lebanon)
        {"id": "ir-il-035", "conflict_id": "iran-israel", "date": "2024-10-02", "location": "Kiryat Shmona", "country": "Israel", "latitude": 33.2075, "longitude": 35.5697, "missile_type": "Fajr-5", "missile_cost": 50000, "intercepted": True, "interceptor_type": "Iron Dome Tamir", "interceptor_cost": 75000, "casualties": 0, "deceased": 0, "description": "Hezbollah rocket barrage intercepted"},
        {"id": "ir-il-036", "conflict_id": "iran-israel", "date": "2024-10-08", "location": "Metula", "country": "Israel", "latitude": 33.2797, "longitude": 35.5778, "missile_type": "Katyusha", "missile_cost": 1000, "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 12, "deceased": 2, "description": "Border town rocket hit"},
        {"id": "ir-il-037", "conflict_id": "iran-israel", "date": "2024-10-15", "location": "Nahariya", "country": "Israel", "latitude": 33.0058, "longitude": 35.0947, "missile_type": "Fajr-5", "missile_cost": 50000, "intercepted": True, "interceptor_type": "Iron Dome Tamir", "interceptor_cost": 75000, "casualties": 0, "deceased": 0, "description": "Coastal city defense success"},
        {"id": "ir-il-038", "conflict_id": "iran-israel", "date": "2024-11-05", "location": "Safed", "country": "Israel", "latitude": 32.9646, "longitude": 35.4960, "missile_type": "Burkan", "missile_cost": 100000, "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 35, "deceased": 8, "description": "Hezbollah heavy rocket strike"},
        {"id": "ir-il-039", "conflict_id": "iran-israel", "date": "2025-01-20", "location": "Acre", "country": "Israel", "latitude": 32.9279, "longitude": 35.0756, "missile_type": "Fajr-5", "missile_cost": 50000, "intercepted": True, "interceptor_type": "Iron Dome Tamir", "interceptor_cost": 75000, "casualties": 0, "deceased": 0, "description": "Historic city protected"},
        {"id": "ir-il-040", "conflict_id": "iran-israel", "date": "2025-02-28", "location": "Tiberias", "country": "Israel", "latitude": 32.7922, "longitude": 35.5312, "missile_type": "Katyusha", "missile_cost": 1000, "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 18, "deceased": 3, "description": "Sea of Galilee area strike"}
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
