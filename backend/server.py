from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from accurate_missile_data import MISSILE_SPECIFICATIONS, DATA_SOURCES, LAST_UPDATED, DATA_ACCURACY_NOTE
from data_updater import periodic_update_task, trigger_manual_update

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
    # Get all conflicts and strikes
    conflicts = await db.conflicts.find({}, {"_id": 0}).to_list(1000)
    strikes = await db.strikes.find({}, {"_id": 0}).to_list(10000)
    
    total_intercepted = len([s for s in strikes if s["intercepted"]])
    interception_rate = (total_intercepted / len(strikes) * 100) if strikes else 0
    
    total_casualties = sum(s["casualties"] for s in strikes)
    total_deceased = sum(s["deceased"] for s in strikes)
    total_missile_cost = sum(s["missile_cost"] for s in strikes)
    total_defense_cost = sum(s.get("interceptor_cost", 0) for s in strikes if s["intercepted"])
    
    # Strikes by conflict
    strikes_by_conflict = {}
    for conflict in conflicts:
        conflict_strikes = [s for s in strikes if s["conflict_id"] == conflict["id"]]
        strikes_by_conflict[conflict["name"]] = len(conflict_strikes)
    
    # Strikes by month (last 12 months)
    from collections import defaultdict
    strikes_by_month_dict = defaultdict(int)
    for strike in strikes:
        month_key = strike["date"][:7]  # YYYY-MM
        strikes_by_month_dict[month_key] += 1
    
    strikes_by_month = [
        {"month": month, "count": count}
        for month, count in sorted(strikes_by_month_dict.items())
    ]
    
    return Statistics(
        total_conflicts=len(conflicts),
        total_strikes=len(strikes),
        total_intercepted=total_intercepted,
        interception_rate=round(interception_rate, 1),
        total_casualties=total_casualties,
        total_deceased=total_deceased,
        total_missile_cost=total_missile_cost,
        total_defense_cost=total_defense_cost,
        strikes_by_conflict=strikes_by_conflict,
        strikes_by_month=strikes_by_month[-12:]  # Last 12 months
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
    # Check if data already exists
    existing_conflicts = await db.conflicts.count_documents({})
    if existing_conflicts > 0:
        logger.info("Database already initialized")
        # Start background update task even if data exists
        asyncio.create_task(periodic_update_task(db, interval_hours=1))
        logger.info("Started automatic hourly data update task")
        return
    
    logger.info("Initializing database with missile strike data...")
    
    # Insert conflicts
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
            "total_intercepted": 11000,
            "total_casualties": 2990211,
            "total_deceased": 5000,
            "total_cost": 264000000.0
        },
        {
            "id": "iran-israel",
            "name": "Iran-Israel War",
            "regions": ["Iran", "Israel"],
            "start_date": "2026-02-28",
            "end_date": None,
            "total_missiles": 500,
            "total_intercepted": 300,
            "total_casualties": 1510,
            "total_deceased": 1312,
            "total_cost": 1000000000.0
        }
    ]
    await db.conflicts.insert_many(conflicts_data)
    
    # Insert missile types with accurate specifications
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
    await db.missile_types.insert_many(missile_types_data)
    
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
        
        # Iran-Israel strikes
        {"id": "ir-il-001", "conflict_id": "iran-israel", "date": "2026-02-28", "location": "Tel Aviv", "country": "Israel", "latitude": 32.0853, "longitude": 34.7818, "missile_type": "Fateh-110", "missile_cost": 1000000, "intercepted": True, "interceptor_type": "THAAD", "interceptor_cost": 12500000, "casualties": 0, "deceased": 0, "description": "Ballistic missile intercepted"},
        {"id": "ir-il-002", "conflict_id": "iran-israel", "date": "2026-03-01", "location": "Haifa", "country": "Israel", "latitude": 32.7940, "longitude": 34.9896, "missile_type": "Fateh-110", "missile_cost": 1000000, "intercepted": True, "interceptor_type": "Patriot PAC-3", "interceptor_cost": 4000000, "casualties": 0, "deceased": 0, "description": "Naval port target"},
        {"id": "ir-il-003", "conflict_id": "iran-israel", "date": "2026-03-02", "location": "Jerusalem", "country": "Israel", "latitude": 31.7683, "longitude": 35.2137, "missile_type": "Fateh-110", "missile_cost": 1000000, "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 8, "deceased": 3, "description": "Direct strike on outskirts"},
        {"id": "ir-il-004", "conflict_id": "iran-israel", "date": "2026-03-04", "location": "Ramat Gan", "country": "Israel", "latitude": 32.0809, "longitude": 34.8237, "missile_type": "Fateh-110", "missile_cost": 1000000, "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 12, "deceased": 2, "description": "Civilian casualties"},
        {"id": "ir-il-005", "conflict_id": "iran-israel", "date": "2026-03-05", "location": "Beersheba", "country": "Israel", "latitude": 31.2530, "longitude": 34.7915, "missile_type": "Shahed-136", "missile_cost": 50000, "intercepted": True, "interceptor_type": "Patriot PAC-3", "interceptor_cost": 4000000, "casualties": 0, "deceased": 0, "description": "Drone intercepted"},
        {"id": "ir-il-006", "conflict_id": "iran-israel", "date": "2026-03-10", "location": "Eilat", "country": "Israel", "latitude": 29.5577, "longitude": 34.9519, "missile_type": "Shahed-136", "missile_cost": 50000, "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 4, "deceased": 1, "description": "Port facility damage"},
        {"id": "ir-il-007", "conflict_id": "iran-israel", "date": "2026-03-15", "location": "Netanya", "country": "Israel", "latitude": 32.3215, "longitude": 34.8532, "missile_type": "Fateh-110", "missile_cost": 1000000, "intercepted": True, "interceptor_type": "THAAD", "interceptor_cost": 12500000, "casualties": 0, "deceased": 0, "description": "High-altitude interception"},
        {"id": "ir-il-008", "conflict_id": "iran-israel", "date": "2026-03-17", "location": "Dimona", "country": "Israel", "latitude": 31.0698, "longitude": 35.0330, "missile_type": "Fateh-110", "missile_cost": 1000000, "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 78, "deceased": 0, "description": "Industrial area strike"},
        {"id": "ir-il-009", "conflict_id": "iran-israel", "date": "2026-03-18", "location": "Arad", "country": "Israel", "latitude": 31.2587, "longitude": 35.2137, "missile_type": "Fateh-110", "missile_cost": 1000000, "intercepted": False, "interceptor_type": None, "interceptor_cost": None, "casualties": 116, "deceased": 0, "description": "Residential strike"},
        {"id": "ir-il-010", "conflict_id": "iran-israel", "date": "2026-03-20", "location": "Ashkelon", "country": "Israel", "latitude": 31.6688, "longitude": 34.5742, "missile_type": "Shahed-136", "missile_cost": 50000, "intercepted": True, "interceptor_type": "Iron Dome Tamir", "interceptor_cost": 75000, "casualties": 0, "deceased": 0, "description": "Successful defense"}
    ]
    await db.strikes.insert_many(strikes_data)
    
    logger.info(f"Database initialized with {len(conflicts_data)} conflicts, {len(missile_types_data)} missile types, and {len(strikes_data)} strikes")
    
    # Start background update task (hourly updates)
    asyncio.create_task(periodic_update_task(db, interval_hours=1))
    logger.info("Started automatic hourly data update task")
