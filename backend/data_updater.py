"""
Automatic Data Updater for Missile Tracking Dashboard
This module provides functionality to update missile strike data automatically
"""

import asyncio
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging

logger = logging.getLogger(__name__)

class MissileDataUpdater:
    def __init__(self, db):
        self.db = db
        
    async def update_statistics(self):
        """Recalculate and update aggregated statistics"""
        try:
            # Get all strikes and conflicts
            strikes = await self.db.strikes.find({}, {"_id": 0}).to_list(10000)
            conflicts = await self.db.conflicts.find({}, {"_id": 0}).to_list(1000)
            
            # Update conflict totals
            for conflict in conflicts:
                conflict_strikes = [s for s in strikes if s["conflict_id"] == conflict["id"]]
                
                total_missiles = len(conflict_strikes)
                total_intercepted = len([s for s in conflict_strikes if s["intercepted"]])
                total_casualties = sum(s["casualties"] for s in conflict_strikes)
                total_deceased = sum(s["deceased"] for s in conflict_strikes)
                total_cost = sum(s["missile_cost"] for s in conflict_strikes)
                
                await self.db.conflicts.update_one(
                    {"id": conflict["id"]},
                    {"$set": {
                        "total_missiles": total_missiles,
                        "total_intercepted": total_intercepted,
                        "total_casualties": total_casualties,
                        "total_deceased": total_deceased,
                        "total_cost": total_cost,
                        "last_updated": datetime.now(timezone.utc).isoformat()
                    }}
                )
            
            logger.info(f"Statistics updated at {datetime.now(timezone.utc)}")
            return True
        except Exception as e:
            logger.error(f"Error updating statistics: {e}")
            return False
    
    async def add_new_strike(self, strike_data):
        """Add a new missile strike to the database"""
        try:
            # Add timestamp
            strike_data["added_at"] = datetime.now(timezone.utc).isoformat()
            
            # Insert strike
            await self.db.strikes.insert_one(strike_data)
            
            # Update statistics
            await self.update_statistics()
            
            logger.info(f"New strike added: {strike_data.get('location', 'Unknown')}")
            return True
        except Exception as e:
            logger.error(f"Error adding strike: {e}")
            return False
    
    async def fetch_latest_news(self):
        """
        Placeholder for news API integration
        
        In production, this would:
        1. Connect to news APIs (Reuters, AP, etc.)
        2. Search for missile strike keywords
        3. Parse location, casualties, missile type
        4. Add verified strikes to database
        
        Example APIs to integrate:
        - NewsAPI (newsapi.org)
        - GDELT Project
        - ACLED (Armed Conflict Location & Event Data)
        """
        logger.info("News fetch placeholder - integrate with real news API")
        # TODO: Integrate with real-time news API
        pass

# Background task for periodic updates
async def periodic_update_task(db, interval_hours=1):
    """Run updates every specified interval"""
    updater = MissileDataUpdater(db)
    
    while True:
        try:
            logger.info(f"Starting periodic update (every {interval_hours} hour(s))")
            
            # Fetch latest news and update data
            await updater.fetch_latest_news()
            await updater.update_statistics()
            
            # Wait for next update
            await asyncio.sleep(interval_hours * 3600)
            
        except Exception as e:
            logger.error(f"Error in periodic update: {e}")
            await asyncio.sleep(300)  # Wait 5 minutes before retry

# Manual update endpoint
async def trigger_manual_update(db):
    """Manually trigger a data update"""
    updater = MissileDataUpdater(db)
    return await updater.update_statistics()
