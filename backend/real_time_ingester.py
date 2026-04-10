"""
real_time_ingester.py

Hourly background task that fetches missile strike reports from OSINT X accounts
via XAPIHandler, parses them, and inserts new strike events into MongoDB.

This runs automatically every 3600 seconds (1 hour) when the FastAPI server starts.
"""

import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

from x_api_handler import XAPIHandler, OSINT_ACCOUNTS

logger = logging.getLogger(__name__)


# ─── Location → Lat/Lng lookup ────────────────────────────────────────────────
GEOCODE_TABLE: Dict[str, tuple] = {
    "kyiv":          (50.4501, 30.5234),
    "kharkiv":       (49.9935, 36.2304),
    "odesa":         (46.4825, 30.7233),
    "dnipro":        (48.4647, 35.0462),
    "zaporizhzhia":  (47.8388, 35.1396),
    "donetsk":       (48.0159, 37.8028),
    "luhansk":       (48.5740, 39.3078),
    "kherson":       (46.6354, 32.6169),
    "mykolaiv":      (46.9750, 31.9946),
    "lviv":          (49.8397, 24.0297),
    "mariupol":      (47.0971, 37.5432),
    "crimea":        (44.9521, 34.1024),
    "sevastopol":    (44.6166, 33.5254),
    "gaza":          (31.5017, 34.4668),
    "tel aviv":      (32.0853, 34.7818),
    "jerusalem":     (31.7683, 35.2137),
    "haifa":         (32.7940, 34.9896),
    "ashkelon":      (31.6688, 34.5742),
    "sderot":        (31.5240, 34.5964),
    "beirut":        (33.8938, 35.5018),
    "damascus":      (33.5138, 36.2765),
    "tehran":        (35.6892, 51.3890),
    "isfahan":       (32.6546, 51.6680),
    "natanz":        (33.7225, 51.7266),
    "iraq":          (33.3152, 44.3661),
    "baghdad":       (33.3152, 44.3661),
}

# ─── Missile type → cost (USD) lookup ─────────────────────────────────────────
MISSILE_COST_TABLE: Dict[str, float] = {
    "kalibr":        1_500_000,
    "iskander":      3_000_000,
    "kinzhal":      12_000_000,
    "kh-101":        7_500_000,
    "kh101":         7_500_000,
    "kh-555":        1_500_000,
    "kh-22":         1_000_000,
    "shahed":           50_000,
    "shahed-136":       50_000,
    "qassam":              300,
    "m-75":            2_000,
    "fateh-110":      150_000,
    "fattah":         500_000,
    "fajr-5":          50_000,
    "katyusha":         1_000,
    "iron dome":       50_000,
    "patriot":      4_000_000,
    "arrow":        3_000_000,
    "thaad":        3_000_000,
    "nasams":         500_000,
    "unknown":        500_000,  # fallback
}

# ─── Location → Conflict mapping ──────────────────────────────────────────────
CONFLICT_MAP: Dict[str, str] = {
    "kyiv": "russia-ukraine",
    "kharkiv": "russia-ukraine",
    "odesa": "russia-ukraine",
    "dnipro": "russia-ukraine",
    "zaporizhzhia": "russia-ukraine",
    "donetsk": "russia-ukraine",
    "luhansk": "russia-ukraine",
    "kherson": "russia-ukraine",
    "mykolaiv": "russia-ukraine",
    "lviv": "russia-ukraine",
    "mariupol": "russia-ukraine",
    "crimea": "russia-ukraine",
    "sevastopol": "russia-ukraine",
    "gaza": "israel-hamas",
    "tel aviv": "israel-hamas",
    "jerusalem": "israel-hamas",
    "haifa": "israel-hamas",
    "ashkelon": "israel-hamas",
    "sderot": "israel-hamas",
    "beirut": "iran-israel",
    "damascus": "iran-israel",
    "tehran": "iran-israel",
    "isfahan": "iran-israel",
    "natanz": "iran-israel",
    "iraq": "iran-israel",
    "baghdad": "iran-israel",
}

# ─── Country → Launch location fallback ───────────────────────────────────────
LAUNCH_LOCATION_MAP: Dict[str, str] = {
    "Russia": "Russian territory",
    "Ukraine": "Ukrainian territory",
    "Iran": "Western Iran",
    "Israel": "Israeli Air Force",
    "Palestine": "Gaza Strip",
    "Hamas": "Gaza Strip",
    "Hezbollah": "Southern Lebanon",
    "Lebanon": "Southern Lebanon",
}

# ─── Interception keywords ─────────────────────────────────────────────────────
INTERCEPT_KEYWORDS = [
    "intercept", "shot down", "iron dome", "patriot", "arrow", "thaad",
    "nasams", "s-300", "s-400", "david's sling", "air defense", "downed",
    "destroyed in flight", "neutralized"
]

INTERCEPTOR_MAP = {
    "iron dome":      ("Iron Dome Tamir",   50_000),
    "patriot":        ("Patriot PAC-3 MSE", 4_000_000),
    "arrow":          ("Arrow 3",           3_000_000),
    "thaad":          ("THAAD",             3_000_000),
    "nasams":         ("NASAMS",            500_000),
    "david's sling":  ("David's Sling",     1_000_000),
    "s-300":          ("S-300",             1_500_000),
    "s-400":          ("S-400",             2_000_000),
}


class RealTimeStrikeIngester:
    """
    Runs every hour: fetches OSINT tweets → parses strike data → inserts into MongoDB.
    """

    def __init__(self, db):
        self.db = db
        self.x_handler = XAPIHandler()

    # ─── Main entry point ────────────────────────────────────────────────────

    async def _write_log(self, status: str, message: str, detail: str = ""):
        """Save a log entry to MongoDB so the admin dashboard can display it."""
        try:
            await self.db.ingestion_logs.insert_one({
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "status": status,       # "ok" | "error" | "warning"
                "message": message,
                "detail": detail,
            })
            # Keep only the last 200 log entries to avoid bloat
            count = await self.db.ingestion_logs.count_documents({})
            if count > 200:
                oldest = await self.db.ingestion_logs.find(
                    {}, {"_id": 1}
                ).sort("timestamp", 1).limit(count - 200).to_list(count - 200)
                ids = [d["_id"] for d in oldest]
                await self.db.ingestion_logs.delete_many({"_id": {"$in": ids}})
        except Exception as e:
            logger.warning(f"Could not write ingestion log: {e}")

    async def ingest_hourly(self):
        """
        Called automatically every 3600 seconds by the FastAPI background task.
        Fetches new tweets and inserts any new strike events found.
        """
        logger.info("Starting hourly strike ingestion from OSINT accounts...")
        await self._write_log("ok", "⏱ Ingestion cycle started", f"Checking {len(OSINT_ACCOUNTS)} OSINT accounts...")

        try:
            raw_strikes = await self.x_handler.fetch_recent_strikes_from_osint()
            logger.info(f"Fetched {len(raw_strikes)} candidate strike tweets")
            await self._write_log("ok", f"📡 Fetched {len(raw_strikes)} candidate tweets from OSINT accounts")

            inserted = 0
            for raw in raw_strikes:
                new = await self._process_strike(raw)
                if new:
                    inserted += 1

            if inserted:
                await self._update_conflict_stats()
                msg = f"✅ Ingestion complete: {inserted} new strike(s) added to database"
                logger.info(msg)
                await self._write_log("ok", msg)
            else:
                msg = "ℹ️ Ingestion complete: no new strikes found this cycle"
                logger.info(msg)
                await self._write_log("ok", msg)

        except Exception as e:
            msg = f"❌ Ingestion error: {str(e)}"
            logger.error(msg, exc_info=True)
            await self._write_log("error", msg, str(e))

    # ─── Strike processing ────────────────────────────────────────────────────

    async def _process_strike(self, raw: Dict[str, Any]) -> bool:
        """
        Check if this tweet is already in the DB. If not, build and insert a strike doc.
        Returns True if a new strike was inserted.
        """
        tweet_id = str(raw.get("tweet_id", ""))
        source   = raw.get("source", "")

        # Deduplicate: skip if same tweet already stored
        existing = await self.db.strikes.find_one(
            {"source_tweet_id": tweet_id, "source_account": source}
        )
        if existing:
            return False

        location     = raw.get("location", "unknown")
        missile_type = raw.get("missile_type", "Unknown")
        country      = raw.get("country", "Unknown")
        text         = raw.get("text", "")
        timestamp    = raw.get("timestamp", datetime.now(timezone.utc).isoformat())
        date         = raw.get("date", datetime.now(timezone.utc).date().isoformat())

        conflict_id      = self._resolve_conflict(location, country, text)
        lat, lng         = self._geocode_location(location)
        intercepted      = self._detect_interception(text)
        interceptor_type, interceptor_cost = self._detect_interceptor(text)
        casualties       = self._extract_number(text, ["wound", "injur", "casualt"])
        deceased         = self._extract_number(text, ["kill", "dead", "death", "deceas"])
        missile_cost     = self._estimate_missile_cost(missile_type)
        launch_location  = self._infer_launch_location(country)

        strike_doc = {
            "id":                  f"osint_{uuid.uuid4().hex[:10]}",
            "conflict_id":         conflict_id,
            "date":                date,
            "location":            location.title(),
            "country":             country,
            "latitude":            lat,
            "longitude":           lng,
            "missile_type":        missile_type,
            "missile_cost":        missile_cost,
            "launch_location":     launch_location,
            "intercepted":         intercepted,
            "interceptor_type":    interceptor_type,
            "interceptor_cost":    interceptor_cost,
            "casualties":          casualties,
            "deceased":            deceased,
            "description":         text[:300],   # first 300 chars of tweet
            "source_account":      source,
            "source_tweet_id":     tweet_id,
            "ingested_at":         datetime.now(timezone.utc).isoformat(),
            "confidence":          raw.get("confidence", 0.7),
        }

        try:
            await self.db.strikes.insert_one(strike_doc)
            msg = f"🚀 New strike recorded: {location.title()} — {missile_type} (via {source})"
            logger.info(msg)
            await self._write_log("ok", msg, text[:120])
            return True
        except Exception as e:
            logger.warning(f"Failed to insert strike: {e}")
            await self._write_log("error", f"❌ Failed to insert strike for {location}", str(e))
            return False

    # ─── Conflict stats recalculation ─────────────────────────────────────────

    async def _update_conflict_stats(self):
        """
        Recalculate totals for each conflict based on all strikes in the DB.
        """
        conflict_ids = ["russia-ukraine", "israel-hamas", "iran-israel"]

        for cid in conflict_ids:
            strikes = await self.db.strikes.find(
                {"conflict_id": cid}, {"_id": 0}
            ).to_list(100_000)

            if not strikes:
                continue

            total_missiles    = len(strikes)
            total_intercepted = sum(1 for s in strikes if s.get("intercepted"))
            total_casualties  = sum(s.get("casualties", 0) for s in strikes)
            total_deceased    = sum(s.get("deceased", 0) for s in strikes)
            missile_cost      = sum(s.get("missile_cost", 0) for s in strikes)
            defense_cost      = sum(
                s.get("interceptor_cost", 0) for s in strikes
                if s.get("intercepted") and s.get("interceptor_cost")
            )
            total_cost = missile_cost + defense_cost

            await self.db.conflicts.update_one(
                {"id": cid},
                {"$set": {
                    "total_missiles":    total_missiles,
                    "total_intercepted": total_intercepted,
                    "total_casualties":  total_casualties,
                    "total_deceased":    total_deceased,
                    "total_cost":        total_cost,
                    "last_updated":      datetime.now(timezone.utc).isoformat(),
                }}
            )
            logger.info(
                f"Updated stats for {cid}: {total_missiles} missiles, "
                f"{total_intercepted} intercepted, {total_deceased} deceased"
            )

    # ─── Helper methods ───────────────────────────────────────────────────────

    def _resolve_conflict(self, location: str, country: str, text: str) -> str:
        loc_lower = location.lower()
        txt_lower = text.lower()

        # Check location map first
        if loc_lower in CONFLICT_MAP:
            return CONFLICT_MAP[loc_lower]

        # Fallback on keywords in tweet text
        if any(kw in txt_lower for kw in ["ukraine", "kyiv", "kharkiv", "russia", "odesa", "dnipro"]):
            return "russia-ukraine"
        if any(kw in txt_lower for kw in ["gaza", "hamas", "israel", "idf", "qassam"]):
            return "israel-hamas"
        if any(kw in txt_lower for kw in ["iran", "hezbollah", "beirut", "tehran", "natanz"]):
            return "iran-israel"

        return "russia-ukraine"  # default fallback

    def _geocode_location(self, location: str) -> tuple:
        loc_lower = location.lower().strip()
        if loc_lower in GEOCODE_TABLE:
            return GEOCODE_TABLE[loc_lower]
        # Partial match
        for key, coords in GEOCODE_TABLE.items():
            if key in loc_lower or loc_lower in key:
                return coords
        return (48.3794, 31.1656)  # default: central Ukraine

    def _detect_interception(self, text: str) -> bool:
        text_lower = text.lower()
        return any(kw in text_lower for kw in INTERCEPT_KEYWORDS)

    def _detect_interceptor(self, text: str):
        text_lower = text.lower()
        for keyword, (name, cost) in INTERCEPTOR_MAP.items():
            if keyword in text_lower:
                return name, cost
        if self._detect_interception(text):
            return "Air Defense System", 1_000_000
        return None, None

    def _extract_number(self, text: str, keywords: List[str]) -> int:
        text_lower = text.lower()
        for kw in keywords:
            if kw in text_lower:
                # Search for a number near the keyword (within 50 chars)
                idx = text_lower.find(kw)
                window = text[max(0, idx - 50): idx + 50]
                numbers = re.findall(r'\b(\d+)\b', window)
                if numbers:
                    return int(numbers[0])
        return 0

    def _estimate_missile_cost(self, missile_type: str) -> float:
        missile_lower = missile_type.lower()
        for key, cost in MISSILE_COST_TABLE.items():
            if key in missile_lower:
                return cost
        return 500_000  # default unknown missile cost

    def _infer_launch_location(self, country: str) -> str:
        return LAUNCH_LOCATION_MAP.get(country, f"{country} territory")