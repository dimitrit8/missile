# Missile Tracking Dashboard - Product Requirements Document

## Original Problem Statement
Build a comprehensive webpage to track missile launches in recent conflicts (Russia-Ukraine, Israel-Hamas-Iran-Lebanon, etc.). Requirements include:
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
- [x] Conflict filtering (All, Russia-Ukraine, Israel-Hamas, Iran-Israel-Lebanon)
- [x] Detailed missile specifications modal
- [x] Defense interceptor specifications (Arrow 3 added)
- [x] Data disclaimer banner with sources and methodology
- [x] Hourly auto-update with GDELT news API integration
- [x] Smart cost formatting (shows M for millions, B for billions)
- [x] AdSense integration ready (ca-pub-1686873956377198)
- [x] Admin Analytics Dashboard (warinfo.net/#/admin)
- [x] Visitor tracking with geolocation

### Data Accuracy Updates (2026-03-27)
**Verified Missile Costs (from 2024-2025 defense contracts):**
- Kalibr: $2,000,000 (Russian contracts)
- Iskander-M: $2,400,000 (RUB 192M)
- Kinzhal: $4,500,000
- Kh-101: $2,500,000
- Shahed-136: $50,000 (Iranian production)
- Qassam-3: $500 (homemade)
- Fateh-110: $150,000 (JINSA analysis)
- Patriot PAC-3 MSE: $4,000,000 (FY2024 Army)
- Iron Dome Tamir: $50,000
- THAAD: $12,700,000 (MDA budget)
- Arrow 3: $4,000,000

**Strike Data Now Includes:**
- Launch location (where missile was fired from)
- Interception location (where it was intercepted)
- All costs verified from trustworthy sources

### Lebanon Added (2026-03-27)
- Conflict renamed to "Iran-Israel-Lebanon War"
- 10 Lebanon strike locations (Beirut, Tyre, Sidon, Baalbek, etc.)
- 6 Hezbollah attacks on northern Israel
- Updated statistics: 5,765 missiles, 15,438 casualties

## Admin Dashboard
- **URL**: `yourdomain.net/#/admin`
- **Password**: `missile2024admin`
- **Features**: Total/unique visitors, geographic breakdown, daily stats, recent visitors table

## API Endpoints
- `GET /api/statistics` - Global aggregated stats
- `GET /api/conflicts` - List all conflicts with totals
- `GET /api/strikes` - Strike data with launch/interception locations
- `GET /api/missile-types` - List of missiles/interceptors with costs
- `GET /api/missile-specifications/{id}` - Detailed specs
- `GET /api/news-feed` - Latest GDELT conflict news
- `GET /api/admin/analytics?password=xxx` - Visitor analytics
- `POST /api/track-visit` - Track page visits

## Future/Backlog
- 3D model viewer for missiles (user to provide GLB files)
- More granular strike data as GDELT reports become available

## Do NOT Implement
- 3D viewer with default models (user rejected, caused React compatibility issues)
