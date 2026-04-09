# Haveloc Guardian

**Multi-Channel Placement Workflow & Scheduling Orchestration Core**

*24/7 Autonomous Email Intelligence · Real-Time Shortlist Detection · Zero-Miss Architecture*

---

![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.110-009688?style=flat-square&logo=fastapi&logoColor=white)
![APScheduler](https://img.shields.io/badge/APScheduler-3.10-FF6B35?style=flat-square)
![Telegram](https://img.shields.io/badge/Telegram-Bot_API-2CA5E0?style=flat-square&logo=telegram&logoColor=white)
![Render](https://img.shields.io/badge/Deployed-Render-46E3B7?style=flat-square)
![Status](https://img.shields.io/badge/Status-Production-brightgreen?style=flat-square)

---

## What Is This?

Haveloc Guardian is a production-grade autonomous agent that monitors your college placement email inbox 24/7, detects when your name appears in shortlist attachments, extracts all event details from the email body, and fires alerts across multiple notification channels — all without you lifting a finger.

Built specifically for **SRMIST Trichy** students receiving placement emails from Haveloc (`alerts@haveloc.com`, `srm@haveloc.com`), but fully configurable for any institution or email source.

### The Problem It Solves

Placement shortlist emails arrive at unpredictable times — sometimes in the middle of the night, sometimes while you're in class. A missed email = a missed opportunity. This system ensures you are notified within 60 seconds of your name appearing in any shortlist, with escalating reminders as the event approaches.

---

## Architecture Overview

```
Gmail IMAP
    │
    ▼
EmailMonitor          ← polls every 60s via APScheduler
    │
    ├── Priority Scorer       ← keyword-based scoring (CRITICAL / HIGH / MEDIUM / LOW)
    ├── Attachment Downloader ← saves .xlsx, .xls, .csv, .pdf, .txt to temp/
    │
    ▼
AttachmentParser      ← scans every row/line for name, register number, email
    │
EventExtractor        ← regex + dateutil extracts company, date, time, platform, links
    │
    ▼
NotificationOrchestrator
    ├── SHORTLIST → Telegram (full details) + SMS (Fast2SMS)
    ├── EMERGENCY → Telegram (urgent alert)
    ├── HIGH/CRITICAL → Telegram (general alert)
    ├── MEDIUM/LOW → Telegram (minimal alert)
    ├── Google Calendar → creates event with 60/30/10 min popup reminders
    └── ReminderScheduler → schedules APScheduler DateTrigger jobs for each event
```

The entire system runs as a **FastAPI web application** deployed on Render. A `/health` endpoint is pinged by UptimeRobot every 5 minutes to keep the free-tier Render dyno alive.

---

## Features

### Core Features

| Feature | Description |
|---|---|
| **Email polling** | Connects to Gmail via IMAP SSL, polls every 60 seconds |
| **Sender filtering** | Only processes emails from configured Haveloc senders/domains |
| **Deduplication** | MD5 hash of `Message-ID + Subject` prevents double-processing, persisted to `logs/processed_ids.json` |
| **Priority scoring** | Keyword-based scoring system — CRITICAL (≥10), HIGH (5–9), MEDIUM (2–4), LOW (0–1) |
| **Emergency detection** | Flags emails containing "today", "urgent", "deadline", "now", "immediately", "asap" |
| **Attachment parsing** | Scans .xlsx, .xls, .csv, .pdf, .txt for your name, register number, or email |
| **Identity confidence** | 1.0 = exact match, 0.8 = partial name match |
| **Event extraction** | Extracts company, event type, date, time, duration, meeting link, platform, instructions |
| **Multi-channel alerts** | Telegram (primary) + SMS via Fast2SMS + Pushover |
| **Google Calendar** | Auto-creates calendar event with description, link, and built-in 60/30/10 min reminders |
| **Scheduled reminders** | APScheduler DateTrigger fires 60min, 30min, 10min before each event |
| **Daily summary** | 8:00 PM IST summary of today's events and upcoming week |
| **Status ping** | System health status sent every 6 hours via Telegram |
| **Telegram bot** | `/status`, `/check`, `/summary`, `/events`, `/help` commands |
| **Web dashboard** | Live status dashboard at `/` |
| **Auto-retry** | All network calls use tenacity retry with exponential backoff |

---

## Project Structure

```
haveloc-guardian/
│
├── main.py                          # FastAPI app — routes, dashboard, Telegram webhook
├── guardian.py                      # HavelocGuardian orchestrator class + scheduler setup
├── requirements.txt
├── runtime.txt                      # python-3.11.9
├── render.yaml                      # Render deployment config
├── env.example                      # All environment variable definitions
│
├── config/
│   └── settings.py                  # Pydantic BaseSettings — loads from .env
│
└── app/
    ├── core/
    │   └── email_monitor.py         # IMAP connection, email fetching, priority scoring
    │
    ├── parsers/
    │   ├── attachment_parser.py     # Scans xlsx/csv/pdf/txt for identity
    │   └── event_extractor.py       # Regex extraction of company, date, time, links
    │
    ├── handlers/
    │   ├── notification_orchestrator.py  # Routes notifications based on priority
    │   ├── calendar_manager.py           # Google Calendar event creation
    │   └── reminder_scheduler.py         # APScheduler DateTrigger reminder jobs
    │
    ├── notifiers/
    │   ├── telegram_notifier.py     # Telegram Bot API (primary channel)
    │   ├── sms_notifier.py          # Fast2SMS (shortlist + 30min/10min reminders)
    │   └── pushover_notifier.py     # Pushover push notifications (optional)
    │
    └── utils/
        └── logger.py                # Loguru — console + daily file + error file
```

---

## Setup Guide

### Prerequisites

- Python 3.11
- A Gmail account with IMAP enabled and an **App Password** generated
- A Telegram bot (create via [@BotFather](https://t.me/BotFather)) and your chat ID
- (Optional) Google Cloud project with Calendar API enabled
- (Optional) Fast2SMS account for SMS fallback
- (Optional) Pushover account for push notifications

---

### Step 1 — Clone and Install

```bash
git clone https://github.com/your-username/haveloc-guardian.git
cd haveloc-guardian
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

---

### Step 2 — Configure Environment

Copy the example file and fill in your values:

```bash
cp env.example .env
```

Open `.env` and set:

```env
# --- YOUR IDENTITY ---
USER_NAME=Your Full Name
USER_NAME_VARIANTS=YourName,YOURNAME,yourname,Your Full Name
REGISTER_NUMBER=RA2211028010001
COLLEGE_EMAIL=you@srmist.edu.in

# --- GMAIL IMAP ---
GMAIL_ADDRESS=you@srmist.edu.in
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx      # 16-char Google App Password
IMAP_SERVER=imap.gmail.com
IMAP_PORT=993

# --- TELEGRAM ---
TELEGRAM_BOT_TOKEN=123456789:ABCdef...
TELEGRAM_CHAT_ID=1234567890

# --- GOOGLE CALENDAR (optional) ---
GOOGLE_CALENDAR_ID=primary
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}   # full JSON as single line

# --- PUSHOVER (optional) ---
PUSHOVER_USER_KEY=your_user_key
PUSHOVER_API_TOKEN=your_api_token

# --- FAST2SMS (optional) ---
FAST2SMS_API_KEY=your_key
USER_PHONE=+919XXXXXXXXX

# --- MONITORING ---
POLL_INTERVAL_SECONDS=60
TIMEZONE=Asia/Kolkata
DAILY_SUMMARY_TIME=20:00

# --- HAVELOC SENDERS ---
HAVELOC_SENDERS=alerts@haveloc.com,srm@haveloc.com
HAVELOC_SENDER_DOMAINS=haveloc.com,career,placement,recruitment
```

#### How to get a Gmail App Password

1. Go to your Google Account → Security → 2-Step Verification (enable it)
2. Go to Security → App Passwords
3. Select app: Mail, device: Other, name it "Guardian"
4. Copy the 16-character password into `GMAIL_APP_PASSWORD`

#### How to get your Telegram Chat ID

1. Start a chat with your bot
2. Send any message
3. Visit: `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`
4. Find `"chat": {"id": 1234567890}` — that number is your `TELEGRAM_CHAT_ID`

---

### Step 3 — Google Calendar Setup (Optional)

**Option A — Service Account (recommended for cloud deployment)**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project → Enable the **Google Calendar API**
3. Create a Service Account → Download the JSON key
4. Share your Google Calendar with the service account email (`...@...iam.gserviceaccount.com`)
5. Paste the entire JSON (minified to one line) into `GOOGLE_SERVICE_ACCOUNT_JSON` in your `.env`

**Option B — OAuth (local development only)**

1. Download `credentials.json` from Google Cloud Console (OAuth 2.0 client)
2. Place it in the project root
3. Run the app once locally — a browser window will open for authorization
4. `logs/token.json` is saved automatically for future runs

---

### Step 4 — Run Locally

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Open your browser at `http://localhost:8000` to see the live dashboard.

Or run directly without FastAPI (no web server, just the guardian loop):

```bash
python guardian.py
```

---

### Step 5 — Deploy to Render

The `render.yaml` is pre-configured for one-click deployment.

1. Push your code to a GitHub repository
2. Go to [render.com](https://render.com) → New Web Service → connect your repo
3. Render auto-detects `render.yaml` — it will use:
   - Build: `pip install --no-cache-dir -r requirements.txt`
   - Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - Health check: `/health`
4. Set all environment variables in Render Dashboard → Environment
   - **Important:** Set `GOOGLE_SERVICE_ACCOUNT_JSON` manually in the Render dashboard (not in `render.yaml`) since it contains sensitive credentials
5. To prevent the free dyno from sleeping, add your Render URL to [UptimeRobot](https://uptimerobot.com/) with a 5-minute ping interval on the `/health` endpoint

---

## How It Works — Detailed Flow

### 1. Email Polling

Every `POLL_INTERVAL_SECONDS` (default: 60s), `EmailMonitor.fetch_new_emails()` runs:

```
IMAP search for FROM "alerts@haveloc.com" + FROM "srm@haveloc.com" + FROM "haveloc"
→ Deduplicate message IDs
→ For each email:
    - Compute MD5 hash of Message-ID + Subject
    - Skip if already in processed_ids.json
    - Check if sender is from Haveloc domain
    - Extract subject, body (plain text preferred, HTML fallback with BeautifulSoup cleanup)
    - Download supported attachments (.xlsx, .xls, .csv, .pdf, .txt) to logs/temp_attachments/
    - Score priority based on keyword matching
    - Flag as emergency if urgent keywords found
```

### 2. Priority Scoring

The scorer scans the combined `subject + body` text:

| Keyword Group | Keywords | Points Each |
|---|---|---|
| High priority | shortlist, selected, test, interview, assessment, deadline, today, urgent, exam, evaluation, process scheduled, online test, aptitude, technical round, hr round, offer, placed, congratulations | +3 |
| Medium priority | application submitted, schedule, next step, round, instructions, registration, confirm | +1 |
| Low priority | announcement, newsletter, general information, update, information | +0 |

Final score → label:
- ≥10 = **CRITICAL**
- 5–9 = **HIGH**
- 2–4 = **MEDIUM**
- 0–1 = **LOW**

Emergency flag = True if body/subject contains: `today`, `urgent`, `deadline`, `now`, `immediately`, `asap`

### 3. Attachment Parsing

`AttachmentParser.parse()` routes to the right parser by extension:

**Excel (.xlsx / .xls):** Uses `openpyxl` in read-only mode. Iterates every row across all sheets. Joins all cell values with `|` and runs identity matching.

**CSV:** Standard `csv.reader`. Joins all fields per row and runs identity matching.

**PDF:** Uses `pdfplumber`. Extracts both text lines and table rows from every page.

**TXT:** Line-by-line scan.

**Identity matching** (`identity_score()` function):

```
1. Check if register number appears in the cell text → confidence 1.0
2. Check if college email appears in the cell text → confidence 1.0
3. Check exact name variant match → confidence 1.0
4. Check partial name variant match → confidence 0.8
```

Best confidence across all rows is kept. Early exit on confidence 1.0.

### 4. Event Extraction

`EventExtractor.extract()` runs regex across the full email text:

| Field | Method |
|---|---|
| Company | Subject-first regex patterns → body fallback → hardcoded known company list (100+ companies) |
| Event type | Keyword map: "online test" → "Online Test", "interview" → "Interview", etc. |
| Date | 7 regex patterns covering all common date formats + "today"/"tomorrow" relative |
| Time | 4 regex patterns covering 12-hour, 24-hour, flexible formats |
| Duration | Matches "60 mins", "2 hours", "duration: 90 minutes" etc. → converts to minutes |
| Meeting link | Extracts first non-tracking URL from body |
| Platform | Matches: HackerRank, HackerEarth, AMCAT, Mettl, Zoom, Google Meet, Teams, Webex |
| Instructions | Extracts text after "Instructions:", "Please note:", "Important:" sections |

After extraction, if both date and time are found, a timezone-aware `datetime` object is computed and stored as `datetime_obj`.

### 5. Notification Routing

`NotificationOrchestrator.handle_email()` decides what to send:

```
if identity_found in attachments:
    → Telegram: full SHORTLIST alert (company, event, date, time, confidence, filename)
    → SMS: shortlist SMS (company, event type, time)

elif is_emergency:
    → Telegram: URGENT alert

elif priority in (CRITICAL, HIGH):
    → Telegram: general alert with keywords

else:
    → Telegram: minimal alert

Always (if datetime_obj exists):
    → Google Calendar: create event with popup reminders
    → ReminderScheduler: schedule 60min, 30min, 10min reminder jobs
```

### 6. Google Calendar Integration

`CalendarManager.create_event()` creates a calendar event with:
- Title: `🎯 {Company} — {Event Type}`
- Description: company, type, email subject, priority, platform, meeting link, instructions
- Start/end time (duration defaults to 90 minutes if not extracted)
- Built-in reminders: 60min and 30min popup + email, 10min popup
- Color: Red (colorId 11) for visual urgency
- Supports both Service Account auth and OAuth token file

### 7. Reminder Jobs

`ReminderScheduler.schedule_reminders()` adds three `DateTrigger` jobs to APScheduler:
- 60 minutes before → Telegram + Pushover (if configured)
- 30 minutes before → Telegram + Pushover + SMS
- 10 minutes before → Telegram + Pushover (emergency priority) + SMS

Each reminder message escalates in urgency (green → yellow → red indicator). Past-due reminders are automatically skipped. All events are persisted to `logs/tracked_events.json`.

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | HTML dashboard with live stats |
| `GET` | `/health` | JSON health check (used by UptimeRobot) |
| `GET` | `/status` | Detailed system status with scheduler jobs |
| `POST` | `/trigger-check` | Manually trigger an immediate email check |
| `POST` | `/telegram-webhook` | Telegram bot webhook handler |

### `/health` Response

```json
{
  "status": "ok",
  "service": "haveloc-guardian",
  "timestamp": "2026-04-08T14:30:00+05:30",
  "uptime_stats": {
    "total_processed": 42,
    "shortlists_found": 3,
    "last_check": "02:30 PM, 08 Apr"
  }
}
```

### `/status` Response

```json
{
  "status": "running",
  "user": "Sudharsan S",
  "monitoring": "sudharsan@srmist.edu.in",
  "poll_interval": 60,
  "stats": { ... },
  "scheduler_jobs": [
    { "id": "email_poll", "next_run": "2026-04-08 14:31:00+05:30" },
    { "id": "daily_summary", "next_run": "2026-04-08 20:00:00+05:30" },
    { "id": "system_status", "next_run": "2026-04-08 18:00:00+05:30" }
  ]
}
```

---

## Telegram Bot Commands

Once deployed, send these commands to your bot:

| Command | Action |
|---|---|
| `/status` | Shows emails processed, shortlists found, events tracked, uptime, last check time |
| `/check` | Forces an immediate email check right now |
| `/summary` | Sends today's events and upcoming 7-day event list |
| `/events` | Lists next 10 upcoming tracked events with company and time |
| `/help` | Lists all available commands |

**Security:** The webhook handler checks `chat_id` against `TELEGRAM_CHAT_ID`. Messages from any other chat are silently ignored.

---

## Notification Channels

### Telegram (Primary — always active)

Sends richly formatted HTML messages for:
- Full shortlist alerts with identity match details and confidence percentage
- Emergency alerts with action prompt
- General HIGH/CRITICAL placement alerts
- 60/30/10 minute pre-event reminders with escalating urgency indicators
- Daily placement summary at 8:00 PM
- System status every 6 hours
- Startup confirmation

### SMS via Fast2SMS (Shortlist + close reminders)

Only fires for:
- Shortlist confirmation (identity found in attachment)
- 30-minute reminders
- 10-minute reminders

SMS messages are capped at 160 characters.

### Pushover (Optional — push notifications)

Supports priority levels:
- Priority 2 (emergency — requires acknowledgment) for shortlists and 10-minute reminders
- Priority 1 (high) for 30-minute reminders
- Different sounds: `siren` for urgent, `bugle` for reminders

### Google Calendar (Always, if datetime extracted)

Creates a structured calendar event visible across all your devices with built-in 60/30/10 minute popup alerts.

---

## Logging

Three log outputs via Loguru:

| Log | Location | Level | Retention |
|---|---|---|---|
| Console | stdout | Configurable via `LOG_LEVEL` env var | Live |
| Daily file | `logs/guardian_YYYY-MM-DD.log` | DEBUG | 7 days, gzip compressed |
| Error file | `logs/errors.log` | ERROR | 30 days, 10MB rotation |

Format: `YYYY-MM-DD HH:mm:ss | LEVEL | module:line - message`

---

## Persistent Data

| File | Purpose |
|---|---|
| `logs/processed_ids.json` | MD5 hashes of all processed emails — prevents reprocessing on restart |
| `logs/tracked_events.json` | All scheduled events with company, type, datetime, reminder offsets |
| `logs/token.json` | Google OAuth token (local development only) |
| `logs/temp_attachments/` | Temp directory for downloaded attachments — cleaned after each email |

---

## Configuration Reference

All settings are in `config/settings.py` and loaded from environment variables (or `.env` file via `python-dotenv`).

| Variable | Default | Description |
|---|---|---|
| `USER_NAME` | `Sudharsan S` | Your full name |
| `USER_NAME_VARIANTS` | `Sudharsan,...` | Comma-separated name variants to search in attachments |
| `REGISTER_NUMBER` | — | Your college register/roll number |
| `COLLEGE_EMAIL` | — | Your college email address |
| `GMAIL_ADDRESS` | — | Gmail address to monitor |
| `GMAIL_APP_PASSWORD` | — | 16-character Gmail App Password |
| `IMAP_SERVER` | `imap.gmail.com` | IMAP server host |
| `IMAP_PORT` | `993` | IMAP SSL port |
| `TELEGRAM_BOT_TOKEN` | — | Token from @BotFather |
| `TELEGRAM_CHAT_ID` | — | Your personal Telegram chat ID |
| `GOOGLE_CALENDAR_ID` | `primary` | Calendar ID (use `primary` for main calendar) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | — | Full service account JSON as a single-line string |
| `GOOGLE_CREDENTIALS_JSON` | `credentials.json` | OAuth credentials file path (local only) |
| `PUSHOVER_USER_KEY` | — | Pushover user key |
| `PUSHOVER_API_TOKEN` | — | Pushover application token |
| `FAST2SMS_API_KEY` | — | Fast2SMS API key |
| `USER_PHONE` | — | Phone number with country code (e.g. `+919XXXXXXXXX`) |
| `POLL_INTERVAL_SECONDS` | `60` | How often to check email (seconds) |
| `EMERGENCY_POLL_INTERVAL` | `30` | Reserved for future emergency mode |
| `TIMEZONE` | `Asia/Kolkata` | Timezone for all scheduling |
| `HAVELOC_SENDERS` | `alerts@haveloc.com,...` | Comma-separated sender addresses to monitor |
| `HAVELOC_SENDER_DOMAINS` | `haveloc.com,...` | Comma-separated domains/keywords to match |
| `DAILY_SUMMARY_TIME` | `20:00` | Time (HH:MM) for daily summary notification |
| `LOG_LEVEL` | `INFO` | Logging level: DEBUG, INFO, WARNING, ERROR |
| `ENVIRONMENT` | `production` | Environment label |

---

## Dependencies

```
fastapi==0.110.0           # Web framework
uvicorn==0.27.1            # ASGI server
pydantic==2.6.4            # Data validation
pydantic-settings==2.2.1   # Settings from env
apscheduler==3.10.4        # Cron and interval job scheduling
httpx==0.27.0              # Async HTTP client (Telegram, Pushover, Fast2SMS)
pytz==2024.2               # Timezone handling
python-dateutil==2.9.0     # Smart date parsing from free-form text
loguru==0.7.2              # Structured logging with rotation
tenacity==8.2.3            # Retry with exponential backoff
beautifulsoup4==4.12.3     # HTML email body cleaning
lxml==5.2.2                # HTML parser for BeautifulSoup
openpyxl                   # Excel (.xlsx) parsing
xlrd                       # Legacy Excel (.xls) parsing
pdfplumber                 # PDF text + table extraction
google-api-python-client   # Google Calendar API
google-auth                # Google authentication
google-auth-oauthlib       # OAuth flow for local dev
aiofiles                   # Async file I/O
python-dotenv              # .env file loading
cryptography==43.0.1       # SSL/TLS support
```

---

## Customizing for Your Institution

This system is built for Haveloc / SRMIST but is fully configurable for any placement email source:

**1. Change the sender filter:**
```env
HAVELOC_SENDERS=placement@youruniversity.edu,noreply@careers.com
HAVELOC_SENDER_DOMAINS=youruniversity.edu,careers.com,placement
```

**2. Update your identity:**
```env
USER_NAME=Your Name
USER_NAME_VARIANTS=YourName,YOUR NAME,yourname
REGISTER_NUMBER=YOUR_ROLL_NUMBER
COLLEGE_EMAIL=you@youruniversity.edu
```

**3. Add your known companies** to the list in `event_extractor.py` (`known_companies` list in `_extract_company()`).

**4. Adjust the keyword scoring** in `email_monitor.py` (`HIGH_PRIORITY_KEYWORDS`, `MEDIUM_PRIORITY_KEYWORDS`, `EMERGENCY_TRIGGERS`) to match the language your placement cell uses.

---

## Troubleshooting

**No emails being processed**

- Check `logs/processed_ids.json` — if all email hashes are already stored, they won't be reprocessed. Delete the file to reset.
- Verify IMAP is enabled in your Gmail settings (Settings → See all settings → Forwarding and POP/IMAP → Enable IMAP).
- Confirm the sender address matches `HAVELOC_SENDERS` exactly.
- Check GMAIL_APP_PASSWORD — it must be an App Password, not your regular Gmail password.

**Telegram notifications not arriving**

- Confirm `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are correct.
- Send `/start` to your bot first — bots cannot initiate conversations.
- Call `GET https://api.telegram.org/bot<TOKEN>/getMe` to verify the token is valid.

**Google Calendar events not being created**

- If using Service Account: confirm the calendar is shared with the service account email (with "Make changes to events" permission).
- If using OAuth: run locally first to generate `logs/token.json`, then upload it to your Render instance.
- Check `logs/errors.log` for the specific Google API error.

**Attachment identity not found**

- Check that `USER_NAME_VARIANTS` covers all the ways your name appears in shortlists (e.g., "S Sudharsan", "Sudharsan S", "SUDHARSAN").
- Confirm `REGISTER_NUMBER` matches exactly (case-insensitive comparison is used internally).
- Set `LOG_LEVEL=DEBUG` to see each row being scanned in the logs.

**App sleeping on Render free tier**

- Add the `/health` URL to [UptimeRobot](https://uptimerobot.com/) as an HTTP monitor with a 5-minute interval.
- UptimeRobot pings the endpoint, Render keeps the dyno warm.

---

## Scheduler Jobs

On startup, three recurring APScheduler jobs are registered:

| Job ID | Trigger | Action |
|---|---|---|
| `email_poll` | IntervalTrigger every `POLL_INTERVAL_SECONDS` | Runs full email check cycle |
| `daily_summary` | CronTrigger at `DAILY_SUMMARY_TIME` (default 20:00 IST) | Sends daily placement summary |
| `system_status` | CronTrigger every 6 hours | Sends system health status to Telegram |

Per-event reminder jobs are added dynamically as events are detected, using `DateTrigger` at the specific reminder times.

---

## Security Notes

- The Telegram webhook handler validates `chat_id` against `TELEGRAM_CHAT_ID` — all other senders are silently rejected.
- Gmail App Passwords are scoped and revocable — they don't give access to your full Google Account.
- All credentials are loaded from environment variables — never hardcoded in source.
- Attachment files are downloaded to a temp directory and deleted immediately after parsing.
- If using `render.yaml`, do not store `GOOGLE_SERVICE_ACCOUNT_JSON` or any secret tokens in the yaml file — set them in the Render dashboard's Environment Variables section.

---

## License

MIT License — free to use, modify, and distribute.

---

*Built for Sudharsan S · SRMIST Trichy · Haveloc Placement System*
*"You won't miss a shortlist." — Haveloc Guardian v1.0*
