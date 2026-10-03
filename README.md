# HabitFlow

A habit tracker for the **web** (installable PWA) and **Android** (native app), built to run privately for one person today and to scale to public users later.

| | |
|---|---|
| **Frontend** | React 19 · TypeScript · Vite · Tailwind CSS 4 · Framer Motion · TanStack Query · Zustand |
| **Backend** | Node.js · Express 5 · TypeScript · Prisma · PostgreSQL · Zod · JWT (access + rotating refresh tokens) · Web Push · node-cron |
| **Android** | Capacitor 8: the same React app as a native APK, with on-device scheduled notifications, haptics and status bar theming |
| **Deploy** | One Docker image (API + website) and PostgreSQL. Works with Docker Compose, Render, Railway, Fly.io or any VPS |

---

## Features

**Core habit tracking**
- Habits that run **every day**, on **specific weekdays**, or **X times per week**
- **Count goals**: e.g. 8 glasses of water, logged one at a time from the card or from a notification
- **Build** habits (do more) and **Quit** habits (days-clean counter, log a slip)
- Current and best **streaks**, a 30-day success rate and total completions
- **Skip** a day for rest or sickness without breaking the streak
- **Streak freezes** ❄️ repair a missed day. You start with 2 and earn 1 for every 25 completions.
- Backfill or edit any past day from a month calendar, with **notes / journal** on every check-in
- Categories, colors, icons, drag-to-reorder, archive and restore
- **Habit stacking**: "after ☕ Coffee → 🧘 Meditate"
- **Templates** for quick start

**Reminders and notifications**
- Any number of reminders per habit, each with its own time, days and custom message
- **Smart**: no nagging once you've done the habit or skipped the day. Messages mention your current streak.
- Action buttons right in the notification: **✅ Done / ➕ Log 1** and **⏰ Snooze 10 min**
- **Projects & courses**: anything with a finish line. Checklist steps (drag to reorder, paste a list to add many), course progress in lessons/videos, a deadline countdown with reminders 3 days, 1 day and 3 hours before and at the deadline, a weekly 7 pm nudge when a project goes quiet, and optional recurring study/work sessions created as a linked habit. Steps and lessons earn XP and train the Intellect stat.
- **Tasks**: one-off to-dos with due dates, priorities and their own reminder (at due time, 10 min before, 1 h before, 1 day before, or a custom time)
- Web: server-sent **Web Push**, which works even with the tab closed
- Android: **exact local alarms** scheduled on the phone, which work offline and survive reboots

**Insights and motivation**
- GitHub-style **year heatmap** (overall and per habit)
- Best weekdays, week-over-week trend, category breakdown
- **Mood tracking** with a **mood × habits** correlation insight
- **Focus timer** (Pomodoro) that can be linked to a habit and auto-complete it when the session ends
- **XP, levels and 21 achievements** (bronze → legendary), with confetti, sounds and haptics
- **Character sheet**: five stats (Strength, Intellect, Vitality, Discipline, Presence) that level up from the habits that train them

**Everything else**
- Seven "desk" themes (Redemption arc is the default), dark / light / system mode and a choice of pen colors
- Export all data as JSON or check-ins as CSV
- Change password, sign out of all devices, delete account
- Close sign-ups with a single env var (`ALLOW_REGISTRATION=false`) for private mode

---

## Project structure

```
Habit tracker/
├── server/                 Express API
│   ├── prisma/             schema.prisma + migrations
│   ├── src/
│   │   ├── routes/         auth, users, habits (+check-ins), projects, stats, moods, focus, tasks, push
│   │   ├── services/       streaks (pure logic), gamification, scheduler, push, habitView
│   │   ├── middleware/     auth, error handling
│   │   └── lib/            dates (timezone-safe), http errors
│   └── test/               streak engine unit tests (vitest)
├── client/                 React app (web + Android)
│   ├── src/
│   │   ├── pages/          Today, Habits, HabitDetail, Projects, ProjectDetail, Stats, Tasks, Focus, Achievements, Settings, Auth
│   │   ├── components/     HabitCard, HabitForm, ProjectForm, Character, Desk, Heatmap, Mood, Layout, ui
│   │   └── lib/            api client, hooks, stores, notifications, dates, celebrate
│   ├── public/             sw.js (service worker), manifest, icons
│   ├── android/            Capacitor Android project
│   └── capacitor.config.ts
├── Dockerfile              all-in-one production image
├── docker-compose.yml      production stack (db + app)
├── docker-compose.dev.yml  development database
└── render.yaml             Render.com blueprint
```

---

## 1. Run it locally (development)

Requirements: Node 22+ and Docker Desktop.

```bash
# 1. Database (Postgres on localhost:5461)
docker compose -f docker-compose.dev.yml up -d

# 2. API on http://localhost:4000
cd server
npm install
npx prisma migrate dev      # creates the tables
npm run dev

# 3. Web app on http://localhost:5173 (in a second terminal)
cd client
npm install
npm run dev
```

`server/.env` is already filled in for development. The database starts empty: open the app and create your account on the sign-in screen.

Run the tests with `cd server && npm test`.

---

## 2. Deploy for personal use

You need **one container plus PostgreSQL**. Pick one option.

### Option A: your own PC or a VPS with Docker Compose (simplest)

```bash
cp .env.example .env          # fill in POSTGRES_PASSWORD, JWT_SECRET, VAPID keys
cd server && npm run vapid    # prints VAPID keys for push notifications
cd .. && docker compose up -d --build
```

The app is now at `http://<machine-ip>:8080` (website, API and PWA together).

> **HTTPS matters.** Browsers only allow push notifications and PWA install on `https://` (or `localhost`).
> On a VPS, put a reverse proxy in front (Caddy is easiest: `habits.example.com { reverse_proxy localhost:8080 }`), or use
> Cloudflare Tunnel / Tailscale Funnel to expose a home PC with HTTPS for free.

### Option B: cloud (no server to maintain)

**Render**: push this folder to GitHub, then in Render choose **New → Blueprint** and pick the repo. `render.yaml` creates the web service and the database. Add `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` in the dashboard.

**Railway / Fly.io / Koyeb**: deploy the root `Dockerfile` and attach a PostgreSQL database (or a free one from [Neon](https://neon.tech)). Set the env vars from `.env.example`, with `DATABASE_URL` pointing at the database. Migrations run automatically on start.

After you create your account, set `ALLOW_REGISTRATION=false` to keep the server private.

---

## 3. Android app

A ready-to-install debug build is in the project root: **`HabitFlow-debug.apk`** (the Gradle output is `client/android/app/build/outputs/apk/debug/app-debug.apk`).

**Install it:** copy the APK to your phone and open it (allow "Install unknown apps"), or with USB debugging:

```bash
adb install -r client/android/app/build/outputs/apk/debug/app-debug.apk
```

**Server address:** the app has no in-app server setting. The address is baked in at build time:
create `client/.env` with `VITE_API_URL=https://your-server` before `npm run android:apk`.
- Deployed (planned: Render): `https://<your-app>.onrender.com`
- Testing on the same Wi-Fi: `http://<your-PC-IP>:8080` (Docker) or `:4000` (dev)

Then go to **Settings → Notifications → Enable**. On Android 12+ also tap **Allow exact alarms** if shown, so reminders arrive on the minute.

**Rebuild after code changes:**

```bash
cd client
npm run android:apk        # builds web, syncs into Android, assembles the debug APK
npm run android:open       # or open in Android Studio to run on a device or emulator
```

> On this Windows machine, Gradle needs a writable Java temp dir. If you see
> `Unable to establish loopback connection`, run first (PowerShell):
> `$env:JAVA_TOOL_OPTIONS="-Djdk.net.unixdomain.tmpdir=$env:TEMP"`

---

## 4. Going public (scaling checklist)

The architecture is ready for multiple users. Everything is scoped per user and the API is stateless. When you open it up:

1. **Hosting**: run 2+ app instances behind a load balancer and use managed Postgres (Neon, RDS, Cloud SQL) with connection pooling (PgBouncer, or Prisma Accelerate).
   Reminder sends are claimed atomically in the database, so several instances never double-send. Set `RUN_SCHEDULER=false` on extra instances anyway to save work.
2. **Static assets**: serve `client/dist` from a CDN (Cloudflare Pages, Vercel, Netlify) and build it with `VITE_API_URL` pointing at the API. Add that origin to `CORS_ORIGINS`.
3. **Android push for closed apps**: local alarms already cover reminders. For server-initiated messages, add Firebase Cloud Messaging (`@capacitor/push-notifications`), then store FCM tokens next to the Web Push subscriptions in `PushSubscription`.
4. **Play Store**: build with `CAP_ALLOW_HTTP=false` (HTTPS only), create a signing key, and run `cd client/android && gradlew bundleRelease`.
5. **Accounts**: add email verification and password reset (an SMTP provider such as Resend or Postmark), and optionally Google sign-in.
6. **Operations**: error tracking (Sentry), uptime checks on `/api/health`, nightly `pg_dump` backups, and a Redis-backed rate limiter for multi-instance limits.
7. **Performance at scale**: cache per-habit streak stats (they are computed from history on read, which is fine for thousands of check-ins per user), and move the reminder scan to a queue such as BullMQ if you reach very large reminder volumes.

---

## Environment variables (server)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Long random string used to sign tokens |
| `CORS_ORIGINS` | Comma-separated browser origins allowed to call the API (`https://localhost` = Android app) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Web Push keys (`npm run vapid`) |
| `ALLOW_REGISTRATION` | `false` closes sign-ups |
| `RUN_SCHEDULER` | `false` disables the reminder loop on this instance |
| `STATIC_DIR` | Folder of the built web app to serve (set automatically in Docker) |
| `PORT` | Default `4000` |
