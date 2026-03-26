# Missile Tracking Dashboard - Product Requirements Document

## Original Problem Statement
Build a comprehensive webpage to track missile launches in recent conflicts (Russia-Ukraine, Israel-Hamas-Iran, etc.). Requirements include:
- Interactive map with exact locations
- Total injuries/deceased statistics
- Types of missiles shot
- Cost per missile
- Counter-missile defense stats
- Interception rates
- Highly accurate researched missile specifications
- Clear disclaimers regarding data sources
- Hourly auto-update system
- Detailed info modals for each missile type

## Tech Stack
- **Frontend**: React 18, TailwindCSS, Recharts, React-Leaflet
- **Backend**: FastAPI (Python), Motor (async MongoDB driver), aiohttp
- **Database**: MongoDB
- **External API**: GDELT DOC 2.0 (free, no API key required)
- **Styling**: Command-center dark theme

## What's Been Implemented

### Core Features (Complete)
- [x] Full-stack app with React frontend + FastAPI backend + MongoDB
- [x] Interactive map with strike locations across multiple regions
- [x] Global statistics dashboard with accurate aggregated numbers
- [x] Conflict filtering (All, Russia-Ukraine, Israel-Hamas, Iran-Israel)
- [x] Detailed missile specifications modal
- [x] Defense interceptor specifications
- [x] Data disclaimer banner with sources and methodology
- [x] Hourly auto-update with GDELT news API integration
- [x] Smart cost formatting (shows M for millions, B for billions)

### Data Coverage (2026-03-26)
**Russia-Ukraine War:**
- 11,466 missiles, 541,783 casualties, 13,000 deceased
- Regions: Ukraine, Russia

**Israel-Hamas Conflict:**
- 13,200 missiles, 45,000 casualties, 5,000 deceased
- Regions: Israel, Gaza

**Iran-Israel War (Updated):**
- 3,960 missiles, 12,238 casualties, 1,218 deceased
- Regions: Iran, Israel, UAE, Saudi Arabia, Qatar
- Map markers now include: Tehran, Isfahan, Shiraz, Dubai, Abu Dhabi, Riyadh, Dhahran, Doha, Al Udeid AFB

### GDELT News API Integration (Complete)
- Real-time conflict news fetching every hour
- Queries: missile strikes, rocket attacks, drone strikes
- News feed stored in MongoDB, accessible via `/api/news-feed`
- No API key required (free public API)

## API Endpoints
- `GET /api/statistics` - Global aggregated stats
- `GET /api/conflicts` - List all conflicts with totals
- `GET /api/strikes` - Strike data for map markers (44 total)
- `GET /api/missile-types` - List of missile/interceptor types
- `GET /api/missile-specifications/{id}` - Detailed specs
- `GET /api/disclaimer` - Data sources and limitations
- `GET /api/news-feed` - Latest GDELT conflict news
- `POST /api/admin/update-data` - Manual data refresh

## Files Structure
```
/app/
├── backend/
│   ├── server.py                 # Core API routes
│   ├── data_updater.py           # GDELT API integration + hourly updates
│   ├── accurate_missile_data.py  # Missile specifications
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── App.js                # Main dashboard
│   │   └── components/
│   │       └── MissileDetailModal.js
└── memory/
    └── PRD.md
```

## Future/Backlog
- Admin Panel for manual strike data entry (original request)
- Display news feed in frontend UI

## Do NOT Implement
- 3D viewer (user rejected, caused React 18 compatibility issues)
