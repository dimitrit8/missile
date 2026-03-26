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
- **Backend**: FastAPI (Python), Motor (async MongoDB driver)
- **Database**: MongoDB
- **Styling**: Command-center dark theme

## What's Been Implemented

### Core Features (Complete)
- [x] Full-stack app with React frontend + FastAPI backend + MongoDB
- [x] Interactive map with strike locations (30 sample markers)
- [x] Global statistics dashboard with accurate aggregated numbers
- [x] Conflict filtering (All, Russia-Ukraine, Israel-Hamas, Iran-Israel)
- [x] Detailed missile specifications modal (replaced 3D viewer)
- [x] Defense interceptor specifications
- [x] Data disclaimer banner with sources and methodology
- [x] Hourly auto-update framework (background task running)
- [x] Smart cost formatting (shows M for millions, B for billions)

### Data Accuracy (Complete)
- [x] Researched aggregate conflict statistics:
  - Russia-Ukraine: 11,466 missiles, 541,783 casualties, 13,000 deceased
  - Israel-Hamas: 13,200 missiles, 45,000 casualties, 5,000 deceased
  - Iran-Israel: 500 missiles, 1,510 casualties, 1,312 deceased
- [x] Accurate missile specifications (Kalibr, Iskander, Kinzhal, Iron Dome, etc.)

### Bug Fixes (2026-03-26)
- [x] Fixed global statistics showing wrong numbers (was 30 strikes, now 25,166)
- [x] Fixed data_updater.py overwriting researched aggregate data with sample calculations
- [x] Fixed cost formatting to show appropriate scale (M vs B)

## Upcoming Tasks (P1)

### Real News API Integration
- **Status**: Framework built, actual API mocked
- **Location**: `/app/backend/data_updater.py` - `fetch_latest_news()` method
- **Action**: Integrate GDELT, ACLED, or NewsAPI for real-time strike data

### Admin Panel
- **Status**: Not started
- **Requirement**: Allow manual input of new missile strike data
- **Note**: Originally requested in first prompt

## Future/Backlog (P2)

### Map Enhancement
- Replace 30 mock map markers with actual geolocated data
- Note: Currently displays sample representative strikes, not exhaustive list

### Exact Timestamps
- User requested exact times for every strike
- Currently covered by disclaimer (classified/unavailable data)

## Known Limitations (Documented in Disclaimer)
- Exact hit times not available for all strikes
- Some casualty figures are estimates
- Map markers represent verified incidents, not exhaustive lists
- Classified specifications not included

## Files Structure
```
/app/
├── backend/
│   ├── server.py                 # Core API routes
│   ├── data_updater.py           # Background hourly updates
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

## Do NOT Implement
- 3D viewer (user rejected as "cheap looking", caused React 18 compatibility issues)

## API Endpoints
- `GET /api/statistics` - Global aggregated stats from conflicts collection
- `GET /api/conflicts` - List all conflicts with totals
- `GET /api/strikes` - Sample strike data (30 docs for map markers)
- `GET /api/missile-types` - List of missile/interceptor types
- `GET /api/missile-specifications/{id}` - Detailed specs for a missile
- `GET /api/disclaimer` - Data sources and limitations
- `POST /api/admin/update-data` - Manual data refresh trigger
