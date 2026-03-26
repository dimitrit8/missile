"""
Automatic Data Updater for Missile Tracking Dashboard
This module provides functionality to update missile strike data automatically
using the GDELT API for real-time conflict news
"""

import asyncio
import aiohttp
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import re

logger = logging.getLogger(__name__)

# GDELT API Configuration
GDELT_DOC_API = "https://api.gdeltproject.org/api/v2/doc/doc"

class MissileDataUpdater:
    def __init__(self, db):
        self.db = db
        
    async def update_statistics(self):
        """Update timestamp on conflicts"""
        try:
            conflicts = await self.db.conflicts.find({}, {"_id": 0}).to_list(1000)
            
            for conflict in conflicts:
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
    
    async def fetch_gdelt_news(self, query: str, max_records: int = 50):
        """Fetch news articles from GDELT DOC 2.0 API"""
        try:
            # Calculate date range (last 24 hours)
            end_date = datetime.now(timezone.utc)
            start_date = end_date - timedelta(hours=24)
            
            params = {
                "query": query,
                "mode": "artlist",
                "maxrecords": max_records,
                "format": "json",
                "startdatetime": start_date.strftime("%Y%m%d%H%M%S"),
                "enddatetime": end_date.strftime("%Y%m%d%H%M%S"),
                "sort": "datedesc"
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(GDELT_DOC_API, params=params, timeout=30) as response:
                    if response.status == 200:
                        data = await response.json()
                        return data.get("articles", [])
                    else:
                        logger.warning(f"GDELT API returned status {response.status}")
                        return []
        except Exception as e:
            logger.error(f"Error fetching GDELT news: {e}")
            return []
    
    async def fetch_latest_news(self):
        """
        Fetch latest conflict news from GDELT API
        Searches for missile/drone strike related articles
        """
        try:
            # Search queries for different conflicts
            queries = [
                "missile strike Ukraine Russia",
                "rocket attack Israel Gaza Hamas",
                "Iran missile drone attack",
                "ballistic missile Middle East",
                "drone strike UAE Saudi Qatar"
            ]
            
            all_articles = []
            for query in queries:
                articles = await self.fetch_gdelt_news(query, max_records=20)
                all_articles.extend(articles)
                await asyncio.sleep(1)  # Rate limiting
            
            if all_articles:
                logger.info(f"Fetched {len(all_articles)} news articles from GDELT")
                
                # Store recent news in database for reference
                await self.db.news_feed.delete_many({})  # Clear old news
                
                for article in all_articles[:100]:  # Keep latest 100
                    news_item = {
                        "title": article.get("title", ""),
                        "url": article.get("url", ""),
                        "source": article.get("domain", ""),
                        "date": article.get("seendate", ""),
                        "language": article.get("language", ""),
                        "fetched_at": datetime.now(timezone.utc).isoformat()
                    }
                    await self.db.news_feed.update_one(
                        {"url": news_item["url"]},
                        {"$set": news_item},
                        upsert=True
                    )
                
                logger.info(f"Stored {min(len(all_articles), 100)} news items in database")
            else:
                logger.info("No new articles found from GDELT")
                
            return True
        except Exception as e:
            logger.error(f"Error in fetch_latest_news: {e}")
            return False
    
    async def add_new_strike(self, strike_data):
        """Add a new missile strike to the database"""
        try:
            strike_data["added_at"] = datetime.now(timezone.utc).isoformat()
            await self.db.strikes.insert_one(strike_data)
            await self.update_statistics()
            logger.info(f"New strike added: {strike_data.get('location', 'Unknown')}")
            return True
        except Exception as e:
            logger.error(f"Error adding strike: {e}")
            return False

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
