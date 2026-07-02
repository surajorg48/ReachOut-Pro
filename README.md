# ReachOut Pro

> **AI-powered HR outreach automation** — discover companies, scrape HR contact details, and send personalized email campaigns at scale.

---

## What Is It?

ReachOut Pro is a full-stack desktop web application that automates the job-seeker's most time-consuming task: finding HR contact information and sending personalized outreach emails. It combines a web scraper, a Google Places–powered discovery engine, a Gmail-integrated email sender, and an AI resume analyzer into a single, unified dashboard.

---

## Key Features

| Feature | Description |
|---|---|
| **Company Management** | Import via Excel, add manually, or auto-import from the scraper. Sort, filter by status/city, and track every company. |
| **Email Scraper** | Paste website URLs and the scraper crawls pages to extract HR emails, names, phone numbers, and social links. |
| **Discover & Scrape** | Search Google Places by keyword + location (country → state → city). Auto-discovers websites, then scrapes them for HR contacts. |
| **Email Campaigns** | Create reusable Markdown email templates with variable placeholders. Send to selected or all pending companies. |
| **Multi-Account Gmail** | Connect multiple Gmail accounts via OAuth2. Switch the active sending account per campaign. |
| **Resume AI Analyzer** | Upload a resume PDF and a job description; the AI scores the match and provides improvement suggestions. |
| **Email Log** | Full history of every email sent — status, timestamp, company, and error details. |
| **Dashboard** | Live stats, bar chart / donut chart visualizations, quick actions, and recent activity feed. |

---

## Tech Stack

### Backend
- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Database**: SQLite 3 via [Knex.js](https://knexjs.org/) (zero-setup, file-based)
- **Email**: Google Gmail API v1 with OAuth2 (`googleapis`)
- **Scraping**: Axios + Cheerio (HTML parsing)
- **Google Places**: Places API (New) via `@googlemaps/google-maps-services-js`
- **Excel I/O**: SheetJS (`xlsx`)
- **AI (Resume)**: Google Gemini API

### Frontend
- **Framework**: React 18 + Vite
- **Routing**: React Router v6
- **Charts**: Recharts
- **HTTP Client**: Axios
- **Notifications**: react-hot-toast
- **Styling**: Vanilla CSS (dark glassmorphism design system)
- **Icons**: Custom SVG library (Lucide-style)

---

## Project Structure

```
reach out pro/
├── backend/
│   ├── src/
│   │   ├── server.js              # Express app + OAuth2 callback handler
│   │   ├── db/
│   │   │   ├── database.js        # Knex SQLite connection
│   │   │   └── init.js            # Table creation & migrations
│   │   ├── routes/
│   │   │   ├── companies.js       # CRUD, import/export, bulk actions
│   │   │   ├── campaigns.js       # Campaign CRUD, send-all, send-selected
│   │   │   ├── email.js           # Test email, single send
│   │   │   ├── scraper.js         # Web scrape, Google Places discover, history
│   │   │   ├── settings.js        # Gmail accounts, OAuth URLs, template
│   │   │   └── resume.js          # Resume PDF upload + AI analysis
│   │   ├── services/
│   │   │   ├── gmail.service.js   # Multi-account OAuth2 management
│   │   │   ├── email.service.js   # Build & send emails via Gmail API
│   │   │   └── discover.service.js # Google Places search logic
│   │   └── utils/
│   │       ├── emailScorer.js     # Heuristic HR email confidence scoring
│   │       └── scraper.js         # Cheerio-based website crawler
│   ├── credentials/               # Per-account credentials & tokens (gitignored)
│   │   └── <account-slug>/
│   │       ├── credentials.json
│   │       └── token.json
│   ├── data/
│   │   └── reachout.db            # SQLite database file (gitignored)
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx                # Layout, sidebar, routing, lazy-loading
│   │   ├── main.jsx               # React entry point
│   │   ├── api/
│   │   │   └── index.js           # All API call wrappers (Axios)
│   │   ├── components/
│   │   │   ├── Icons.jsx          # Centralized SVG icon library
│   │   │   └── Skeleton.jsx       # Skeleton loader components
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx      # Stats + charts + activity feed
│   │   │   ├── Companies.jsx      # Company table, sort, filter, bulk actions
│   │   │   ├── Scraper.jsx        # Manual URL scraping interface
│   │   │   ├── DiscoverScraper.jsx # Google Places discovery + history
│   │   │   ├── Campaigns.jsx      # Campaign list
│   │   │   ├── CampaignCompose.jsx # Template editor + send controls
│   │   │   ├── EmailLog.jsx       # Full email history log
│   │   │   ├── Settings.jsx       # Gmail accounts, template, app settings
│   │   │   └── ResumeAnalyzer.jsx # PDF upload + AI score
│   │   └── styles/
│   │       └── global.css         # Design system (variables, components, animations)
│   ├── index.html
│   └── package.json
│
├── templates/
│   └── email_template.md          # Default email template (Markdown)
├── README.md
└── secret.json                    # (gitignored) Google API keys
```

---

## Database Schema

| Table | Key Columns |
|---|---|
| `companies` | `id`, `name`, `website`, `industry`, `city`, `status`, `created_at` |
| `contacts` | `id`, `company_id`, `email`, `name`, `role`, `phone`, `score` |
| `campaigns` | `id`, `name`, `subject`, `template`, `status`, `created_at` |
| `email_logs` | `id`, `campaign_id`, `company_id`, `recipient_email`, `status`, `sent_at`, `error` |
| `settings` | `key`, `value` (key-value store for app config) |
| `gmail_accounts` | `id`, `email`, `label`, `credentials_path`, `token_path`, `is_active` |
| `discover_history` | `id`, `keywords`, `location`, `result_count`, `created_at` |

---

## Gmail Multi-Account Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project → Enable **Gmail API**
3. Configure OAuth consent screen (External, Scopes: `gmail.send`, `gmail.readonly`)
4. Create **OAuth 2.0 Client ID** (Application type: **Web application**)
5. Add Authorized Redirect URI: `http://localhost:3001/auth/callback`
6. Download the JSON file (it will be named `client_secret_...json`)
7. In ReachOut Pro → **Settings → Gmail Accounts → Add Account**
8. Enter your Gmail address, upload the JSON file, click **Save**
9. Click **Connect** and complete the Google sign-in flow

> Each account gets its own isolated credentials directory under `backend/credentials/`.

---

## Email Template Variables

Templates are written in Markdown. Use `{{variable_name}}` placeholders:

| Variable | Description |
|---|---|
| `{{company_name}}` | Company name |
| `{{hr_name}}` | HR contact name |
| `{{applicant_name}}` | Your name (from campaign settings) |
| `{{role}}` | Job role you're applying for |
| `{{skills}}` | Your skills summary |

---

## Running Locally

```bash
# Backend
cd backend
npm install
npm start          # Runs on http://localhost:3001

# Frontend (in a new terminal)
cd frontend
npm install
npm run dev        # Runs on http://localhost:5173
```

> **Prerequisite:** Place `secret.json` in the project root for Google Places API and Gemini AI features.

---

## Environment & Configuration

All configuration is stored in the SQLite `settings` table and managed through the Settings UI. No `.env` file is required for basic operation.

| Setting Key | Description |
|---|---|
| `sender_email` | Active Gmail address used for sending |
| `active_gmail_account` | ID of the currently active Gmail account |
| `gmail_connected` | Boolean flag for legacy single-account setup |
| `_pending_auth_account` | Temporary flag during OAuth2 flow |

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/companies` | List companies with filters & sort |
| `POST` | `/api/companies` | Add a company |
| `DELETE` | `/api/companies/:id` | Delete a company |
| `POST` | `/api/companies/import-excel` | Bulk import from Excel |
| `GET` | `/api/companies/export-excel` | Export all to Excel |
| `GET` | `/api/campaigns` | List all campaigns |
| `POST` | `/api/campaigns/:id/send-all` | Send to all pending companies |
| `POST` | `/api/campaigns/:id/send-selected` | Send to specific company IDs |
| `POST` | `/api/scraper/run` | Scrape a list of URLs |
| `POST` | `/api/scraper/discover` | Search Google Places |
| `GET` | `/api/settings/gmail/accounts` | List Gmail accounts |
| `POST` | `/api/settings/gmail/accounts` | Add a Gmail account |
| `POST` | `/api/settings/gmail/accounts/:id/activate` | Set active account |
| `POST` | `/api/settings/gmail/accounts/:id/disconnect` | Remove OAuth token |
| `DELETE` | `/api/settings/gmail/accounts/:id` | Delete account & credentials |
| `GET` | `/auth/callback` | OAuth2 callback (Google redirect) |

---

## Notes & Limitations

- The scraper respects `robots.txt` only informally — use responsibly.
- Google Places API requires a billing-enabled GCP project (has a free tier).
- Gmail API sending limits apply (500 emails/day for personal accounts).
- SQLite is suitable for personal/small-team use. For scale, migrate to PostgreSQL via Knex config.

---

*Built with Node.js, React, SQLite, and the Google APIs ecosystem.*
