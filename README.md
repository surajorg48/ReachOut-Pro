# ReachOut Pro — HR Email Scraper & Mailer

> Automated job application system: scrape IT company websites for HR emails, compose personalized emails from Markdown templates, and send them with your resume attached — all from a slick dark-mode web UI.

---

## 🚀 Quick Start

### Prerequisites
- Node.js v18+
- A Gmail account (`surajorg47@gmail.com`)
- Your Google Cloud `credentials.json` (see Gmail Setup below)

---

### 1. Install Dependencies

```powershell
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Start the App

Open **two terminals**:

**Terminal 1 — Backend:**
```powershell
cd backend
npm run dev
# Server starts at http://localhost:3001
```

**Terminal 2 — Frontend:**
```powershell
cd frontend
npm run dev
# UI starts at http://localhost:5173
```

Open your browser at: **http://localhost:5173**

---

## 📧 Gmail API Setup (One-Time)

Follow these steps to get your `credentials.json`. **No Gmail password required.**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project → Name: **ReachOut Pro**
3. Enable **Gmail API** (APIs & Services → Library → Gmail API)
4. Configure **OAuth Consent Screen** → External → Add `surajorg47@gmail.com` as test user
5. Create **Credentials** → OAuth 2.0 Client → **Desktop app** → Download JSON
6. In the app: go to **Settings → Upload credentials.json → Connect Gmail**
7. A browser tab opens → Log in with Gmail → Authorize → Done ✅

---

## 📁 Project Structure

```
scrapper/
├── backend/               # Node.js Express API
│   ├── src/
│   │   ├── server.js
│   │   ├── db/            # SQLite database
│   │   ├── routes/        # API endpoints
│   │   ├── services/      # Gmail, Email, Scraper
│   │   └── utils/         # Scoring, template rendering
│   ├── data/              # SQLite DB file
│   ├── credentials/       # Place credentials.json here
│   └── .env
│
├── frontend/              # React + Vite UI
│   └── src/
│       ├── pages/         # All UI pages
│       ├── api/           # API client
│       └── styles/        # CSS design system
│
├── templates/
│   └── email_template.md  # Default email template
├── Suraj_Choudhari_Resume.pdf
└── README.md
```

---

## 📊 Features

| Feature | Description |
|---|---|
| 🔍 Web Scraper | Scrapes company websites for HR emails using Puppeteer + Cheerio |
| 📂 Excel Import | Upload Excel with company names + emails |
| 📥 Excel Template | Download blank template to fill and import |
| 📤 Excel Export | Export all data as Excel |
| 📝 Campaign Editor | Markdown email editor with live preview |
| 🎯 Placeholders | `{{company_name}}`, `{{hr_name}}`, `{{position}}`, etc. |
| 🧪 Test Email | Send a test before bulk send |
| 📨 Bulk Send | Send to selected companies or all pending |
| ⏱️ Rate Limiting | Configurable delay between emails |
| 📋 Email Log | Track every send attempt with status |
| 🔁 Retry | Retry failed emails with one click |
| ⚙️ Settings | Gmail OAuth, resume path, delay slider |

---

## 🛡️ Security

- Gmail credentials stored locally in `backend/credentials/`
- OAuth 2.0 — no Gmail password ever stored
- All data is local (SQLite), nothing goes to the cloud

---

## 📋 Excel Template Columns

| Column | Required | Example |
|---|---|---|
| Company Name | Yes | TCS Pvt Ltd |
| Website | No | https://tcs.com |
| Industry | No | IT |
| City | No | Pune |
| Email | Yes | hr@tcs.com |
| HR Name | No | Priya Sharma |
| Role | No | HR Manager |

---

Made with ❤️ for Suraj Choudhari's job search journey 🚀
