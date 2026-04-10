"""
x_api_handler.py

Fetches real-time missile strike data from OSINT X (Twitter) accounts.
Uses the X API v2 with Tweepy library to pull recent tweets from key accounts
that report military events as they happen.

Accounts tracked:
- @OSINTtechnical   — Real-time military operations analysis
- @OSINTdefender    — Defense & conflict intelligence
- @TheSpectatorIdx  — Real-time breaking news & events
- @TheStudyofWar    — Institute for the Study of War (ISW)
- @ACLEDDATA        — Armed Conflict Location & Event Data Project
- @Liveuamap        — Live Universal Awareness Map
- @IntelAirForce    — Air Force & aerospace intelligence
- @War_Mapper       — Conflict mapping & frontline updates
- @Sentdefender     — Geopolitical & conflict analyst
- @AnshelPfeffer    — Senior journalist, conflict reporting
- @N_Zidan          — Middle East conflict analyst
- @CENTCOM          — US Central Command official
"""

import os
import logging
from datetime import datetime, timezone, timedelta
import re
from typing import List, Optional, Dict, Any

try:
    import tweepy
except ImportError:
    tweepy = None

logger = logging.getLogger(__name__)

# X/Twitter accounts to monitor for missile strike reports
OSINT_ACCOUNTS = [
    "OSINTtechnical",
    "OSINTdefender",
    "TheSpectatorIdx",
    "TheStudyofWar",
    "ACLEDDATA",
    "Liveuamap",
    "IntelAirForce",
    "War_Mapper",
    "Sentdefender",
    "AnshelPfeffer",
    "N_Zidan",
    "CENTCOM",
]

class XAPIHandler:
    def __init__(self):
        self.api_key = os.environ.get('X_API_KEY')
        self.api_secret = os.environ.get('X_API_SECRET')
        self.access_token = os.environ.get('X_ACCESS_TOKEN')
        self.access_token_secret = os.environ.get('X_ACCESS_TOKEN_SECRET')
        self.client = None
        self.initialized = False

        if not all([self.api_key, self.api_secret, self.access_token, self.access_token_secret]):
            logger.warning("X API credentials not fully configured — real-time tweet fetching disabled")
            return

        if tweepy is None:
            logger.warning("tweepy not installed — install with: pip install tweepy")
            return

        try:
            self.client = tweepy.Client(
                consumer_key=self.api_key,
                consumer_secret=self.api_secret,
                access_token=self.access_token,
                access_token_secret=self.access_token_secret,
                wait_on_rate_limit=True
            )
            self.initialized = True
            logger.info("X API handler initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize X API client: {e}")

    async def fetch_recent_strikes_from_osint(self) -> List[Dict[str, Any]]:
        """
        Fetch recent missile strike reports from OSINT accounts.
        Returns a list of strike events extracted from tweets.
        """
        if not self.initialized or not self.client:
            return []

        strikes = []

        for account in OSINT_ACCOUNTS:
            try:
                # Fetch last 20 tweets from this account (real-time window)
                tweets = self.client.get_users_tweets(
                    id=self._get_user_id(account),
                    max_results=20,
                    tweet_fields=['created_at', 'public_metrics'],
                    expansions=['author_id'],
                )

                if not tweets or not tweets.data:
                    continue

                for tweet in tweets.data:
                    text = tweet.text.lower()

                    # Pattern matching for missile/strike keywords
                    if any(kw in text for kw in ['missile', 'strike', 'launch', 'drone', 'attack', 'intercept', 'shot down']):
                        strike = self._parse_strike_from_tweet(tweet, account)
                        if strike:
                            strikes.append(strike)

            except Exception as e:
                logger.warning(f"Error fetching tweets from @{account}: {e}")

        return strikes

    def _get_user_id(self, username: str) -> str:
        """Cache user IDs to avoid repeated lookups"""
        if not self.client:
            return ""

        # Simple cache in memory — in production use Redis
        if not hasattr(self, '_user_id_cache'):
            self._user_id_cache = {}

        if username in self._user_id_cache:
            return self._user_id_cache[username]

        try:
            user = self.client.get_user(username=username)
            if user and user.data:
                user_id = user.data.id
                self._user_id_cache[username] = user_id
                return user_id
        except Exception as e:
            logger.warning(f"Could not fetch user ID for @{username}: {e}")

        return ""

    def _parse_strike_from_tweet(self, tweet, account: str) -> Optional[Dict[str, Any]]:
        """
        Extract strike information from tweet text using pattern matching.
        Returns a structured event or None if no strike detected.
        """
        text = tweet.text
        created_at = tweet.created_at

        # Keywords for strike confirmation
        strike_keywords = ['missile', 'strike', 'launched', 'fired', 'attack', 'drone']
        if not any(kw in text.lower() for kw in strike_keywords):
            return None

        # Try to extract location patterns
        location = self._extract_location(text)
        missile_type = self._extract_missile_type(text)
        country = self._infer_country(text, account)

        if not location or not country:
            return None  # Can't confirm strike without location and country

        return {
            "id": f"osint_{account}_{tweet.id}",
            "source": f"@{account}",
            "tweet_id": tweet.id,
            "text": text,
            "location": location,
            "missile_type": missile_type or "Unknown",
            "country": country,
            "timestamp": created_at.isoformat() if created_at else datetime.now(timezone.utc).isoformat(),
            "date": (created_at.date().isoformat() if created_at else datetime.now(timezone.utc).date().isoformat()),
            "confidence": 0.7,  # OSINT tweets are high confidence but not verified
        }

    def _extract_location(self, text: str) -> Optional[str]:
        """Extract location from tweet using keywords and patterns"""
        text_lower = text.lower()

        # Common missile strike locations
        locations = {
            'kyiv': ['kyiv', 'kiev', 'kiyiv'],
            'kharkiv': ['kharkiv', 'kharkov'],
            'odesa': ['odesa', 'odessa'],
            'dnipro': ['dnipro', 'dnipropetrovsk'],
            'zaporizhzhia': ['zaporizhzhia', 'zaporizhia'],
            'donetsk': ['donetsk'],
            'luhansk': ['luhansk', 'lugansk'],
            'kherson': ['kherson'],
            'crimea': ['crimea'],
            'gaza': ['gaza'],
            'tel aviv': ['tel aviv'],
            'jerusalem': ['jerusalem'],
            'beirut': ['beirut'],
            'damascus': ['damascus'],
            'tehran': ['tehran'],
            'iraq': ['iraq', 'baghdad'],
        }

        for loc, keywords in locations.items():
            if any(kw in text_lower for kw in keywords):
                return loc

        return None

    def _extract_missile_type(self, text: str) -> Optional[str]:
        """Extract missile type from tweet"""
        text_lower = text.lower()

        missile_types = [
            'kalibr', 'iskander', 'kinzhal', 'kh-101', 'kh101', 'kh-555',
            'shahed', 'shahed-136', 'qassam', 'fateh', 'fateh-110',
            'patriot', 'thaad', 'arrow', 'iron dome', 'david\'s sling',
            's-300', 's-400', 'buk', 'pantsir',
        ]

        for missile in missile_types:
            if missile in text_lower:
                return missile

        return None

    def _infer_country(self, text: str, account: str) -> Optional[str]:
        """Infer originating country from tweet context"""
        text_lower = text.lower()

        # If tweet mentions Iran/IRGC/Iran missiles
        if any(kw in text_lower for kw in ['iran', 'irgc', 'tehran', 'fateh', 'qassam']):
            return 'Iran'

        # Russia/Ukraine
        if any(kw in text_lower for kw in ['russia', 'ukrainian', 'ukraine', 'kalibr', 'iskander', 'kinzhal']):
            if 'ukraine' in text_lower or 'kyiv' in text_lower:
                return 'Russia'
            return 'Russia'

        # Israel/Hamas
        if any(kw in text_lower for kw in ['israel', 'gaza', 'hamas', 'idf', 'palestine']):
            if 'hamas' in text_lower or 'qassam' in text_lower or 'gaza' in text_lower:
                return 'Palestine'
            return 'Israel'

        # Default based on account focus
        if 'ukraine' in account.lower():
            return 'Russia'

        return None