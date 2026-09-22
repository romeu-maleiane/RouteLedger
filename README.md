# RouteLedger — FMCSA HOS Trip Planner & Daily Log Generator

Full-stack application built with **React (TypeScript & Vite)**, **Django**, and **MongoDB Atlas** for calculating interstate commercial motor vehicle (CMV) routes, scheduling FMCSA-compliant Hours of Service (HOS) rest and fuel stops, rendering interactive route maps, and drawing official 24-hour Driver's Daily Log sheets with PDF export.

---

## Features & Deliverables

1. **Clean 4-Input Planner Interface**
   - Current location (driver starting point)
   - Pickup location (1 hour on-duty loading)
   - Dropoff location (1 hour on-duty unloading)
   - Current Cycle Used (0 to 70 hours in 8-day rolling window)
   - **No login required to plan, view route, view daily logs, or export PDF**.

2. **HOS Compliance Engine (49 CFR § 395)**
   - Property-carrying driver on the 70-hour / 8-day cycle.
   - 11-Hour Driving Limit: schedules a mandatory 10-hour consecutive rest break when 11h driving is reached.
   - 14-Hour Duty Window: forces a 10-hour rest if the 14h consecutive window elapses.
   - 30-Minute Rest Break: scheduled prior to exceeding 8 cumulative driving hours.
   - Fuel Stops: automatically scheduled at least every 1,000 miles (30 min on-duty).
   - 34-Hour Cycle Restart: triggered when 70 hours on duty is exhausted, resetting available cycle hours.

3. **Interactive Route & Stops Map**
   - Built with **Leaflet** and OpenStreetMap.
   - Real-world route geometry generated via OSRM.
   - Interactive markers for Origin, Pickup Stop, Dropoff Stop, Rest Breaks, and Fuel Stops with zoom-to-fit bounding box.

4. **Official FMCSA Driver's Daily Log Sheets**
   - Full regulatory 24-hour graph grid (Midnight to Midnight) matching FMCSA paper log standards.
   - Plotted across the 4 duty status rows:
     1. Off Duty
     2. Sleeper Berth
     3. Driving
     4. On Duty (Not Driving)
   - Dynamic multi-day breakdown: short trips generate 1 log sheet; long trips generate multiple sheets (Day 1, Day 2, Day 3...) with continuous line transitions and tick marks.
   - Total hours calculated per duty status (= 24.00h each day).
   - Remarks section annotating duty status change locations and time.
   - **One-click Export to PDF** using `html2pdf.js` with browser print stylesheet fallback.

5. **MongoDB Atlas & User Management**
   - Optional Authentication: Drivers and carriers can register and sign in to persist and manage their trips.
   - Save trips directly to MongoDB Atlas.
   - "My Trips" dashboard: list, inspect details, re-load route into workspace, or delete trips from Atlas.

6. **Comprehensive Automated Test Suite**
   - 9 automated Django test cases covering the HOS engine edge cases (short trips, 11h/14h limits, 70h cycle exhaustion) and API CRUD/Auth flows.

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Leaflet, Lucide Icons, html2pdf.js.
- **Backend**: Django 5.1, Django REST endpoints, PyMongo, PyJWT, bcrypt, Requests (Nominatim Geocoding & OSRM routing).
- **Database**: MongoDB Atlas (or local MongoDB via Docker).

---

## Local Setup

### 1. Backend Setup

```bash
cd backend
python -m venv .venv

# On Windows:
.venv\Scripts\activate
# On macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
```

Create `backend/.env` from `.env.example`:
```env
DJANGO_SECRET_KEY=a-long-secure-random-key-with-at-least-32-characters
DJANGO_DEBUG=true
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:5173

# MongoDB Atlas (or local MongoDB):
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.example.mongodb.net/hos_trip_planner?retryWrites=true&w=majority
MONGO_DATABASE=hos_trip_planner
```

Run tests:
```bash
python manage.py test
```

Start backend:
```bash
python manage.py runserver 8000
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will run at `http://localhost:5173`.

---

## Deployment Guide

### Frontend on Vercel
1. Link your GitHub repository to [Vercel](https://vercel.com).
2. Set Root Directory to `./frontend` or use the root `vercel.json`.
3. Set the build command to `npm run build` and output directory to `dist`.
4. Add environment variable if needed: `VITE_API_URL=<your-deployed-backend-url>`.

### Backend on Render / Railway
1. A `render.yaml` and `Procfile` are included in the repository.
2. Link the repository to [Render](https://render.com) as a Web Service.
3. Configure environment variables in Render:
   - `DJANGO_SECRET_KEY`
   - `MONGO_URI` (your MongoDB Atlas connection string)
   - `CORS_ALLOWED_ORIGINS` (your Vercel frontend URL)
   - `DJANGO_DEBUG=false`

