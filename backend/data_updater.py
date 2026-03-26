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
        """Recalculate and update aggregated statistics timestamp"""
        try:
            # NOTE: We preserve the researched aggregate numbers in conflicts collection
            # Only update the last_updated timestamp, NOT the totals
            # The totals (total_missiles, total_casualties, etc.) come from researched data
            # and should not be recalculated from the sample strikes collection
            
            conflicts = await self.db.conflicts.find({}, {"_id": 0}).to_list(1000)
            
            for conflict in conflicts:
                # Only update timestamp, preserve the researched aggregate numbers
                await self.db.conflicts.update_one(
                    {"id": conflict["id"]},
                    {"$set": {
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
