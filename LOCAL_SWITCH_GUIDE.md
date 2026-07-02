# Local & Production Environments Guide

ReachOut Pro is configured to work in both **Local Development** (using SQLite and `localhost` proxies) and **Production Deployment** (using Neon PostgreSQL and hosted endpoints) **seamlessly**. 

You do **not** need to modify or uncomment any lines of code to switch between these environments. The switch is controlled entirely through **Environment Variables** (`.env` files or platform settings).

---

## 1. How It Works (The Environment Matrix)

Our codebase automatically detects which environment it is running in based on the presence of these environment variables:

| Variable | Scope | When Present (Production/Cloud) | When Absent (Localhost / SQLite) |
|---|---|---|---|
| **`DATABASE_URL`** | Backend | Connects to Neon PostgreSQL | Falls back to local `backend/data/reachout.db` (SQLite) |
| **`BACKEND_URL`** | Backend | Generates Google OAuth redirect to Render endpoint | Defaults OAuth redirect to `http://localhost:3001/auth/callback` |
| **`VITE_API_URL`** | Frontend | Sends API requests to your hosted Render backend | Sends API requests to `/api` (proxied to `http://localhost:3001`) |

---

## 2. Running Locally (SQLite & Localhost)

To run the application on your local machine using SQLite:

### Step A: Configure Backend `.env`
Create or edit `backend/.env`. Ensure **`DATABASE_URL`** is commented out or removed:
```env
PORT=3001
# DATABASE_URL=postgresql://... (COMMENTED OUT)
# BACKEND_URL=https://... (COMMENTED OUT)
```

### Step B: Configure Frontend `.env` (Optional)
If you have a `frontend/.env` file, ensure **`VITE_API_URL`** is commented out or removed so Vite falls back to local proxying:
```env
# VITE_API_URL=https://... (COMMENTED OUT)
```

### Step C: Run the Application
1. **Start Backend:**
   ```bash
   cd backend
   npm install
   npm start
   ```
   *Your database will automatically initialize in `backend/data/reachout.db`.*

2. **Start Frontend (in a separate terminal):**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   *Open `http://localhost:5173` to access the application.*

---

## 3. Running in Production (PostgreSQL & Render/Vercel)

To run the application in the cloud:

### Step A: Backend Environment Settings (on Render)
Add the following Environment Variables in the Render settings panel:
*   **`DATABASE_URL`**: `postgresql://neondb_owner:npg_FveQ2BNkAg4t@ep-rapid-voice-atze5kxg.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require`
*   **`BACKEND_URL`**: `https://reachout-pro-backend.onrender.com`

### Step B: Frontend Environment Settings (on Vercel)
Add the following Environment Variable in the Vercel settings panel:
*   **`VITE_API_URL`**: `https://reachout-pro-backend.onrender.com`

### Step C: Google Cloud Console Redirect URI
Ensure your Google OAuth credentials allow both redirect URIs:
1. Go to your **GCP Console** -> APIs & Services -> Credentials.
2. Select your OAuth 2.0 Client ID.
3. In **Authorized redirect URIs**, add both:
   *   `http://localhost:3001/auth/callback` (for local development)
   *   `https://reachout-pro-backend.onrender.com/auth/callback` (for cloud production)
