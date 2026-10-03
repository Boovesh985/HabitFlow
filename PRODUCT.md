# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary user (now):** the owner, Sakthi, using HabitFlow for their own habits. Day to day this happens on the Android app (the same web UI packaged with Capacitor): quick check-ins in the morning and at night, and reacting to reminders. The laptop/website is for occasional review.
- **Later audience:** undecided. Opening to others is planned, but whether that means friends and family, a free public sign-up, or paid features has not been chosen. Do not design for a specific public audience until it is.

## Product Purpose

HabitFlow is the owner's **self-development and character-development** tool: a redemption arc tracked day by day. The core routines are gym, DSA practice, water, skincare and general health, plus whatever else the arc needs.

Help one person show up for the habits they care about, every day, and see honestly how it's going. Success is daily use that feels like a small ritual rather than a chore, with streaks that survive real life and reminders that land at the right moment.

## Positioning

HabitFlow is meant to be known for four things together:
1. **Forgiving streaks:** skips, rest days and earned streak freezes, so one bad day doesn't erase weeks of progress.
2. **Act from the notification:** reminders can be completed ("Done" / "Log 1") or snoozed without opening the app, on both web push and Android.
3. **Honest insights:** patterns like mood vs. habits and best/worst weekdays, explained in plain sentences rather than vanity metrics.
4. **A daily ritual feel:** checking in should feel satisfying and personal.

## Operating Context

- Short, frequent sessions on a phone: open, check off a few habits, close. Longer, occasional review sessions on a laptop (Insights, a habit's history, editing habits).
- Reminders arrive as notifications: server-sent Web Push in browsers; exact local alarms scheduled on the device on Android, which work offline.
- The user's timezone is Asia/Kolkata; "today" is always the user's local calendar day.

## Capabilities and Constraints

- Habits: daily, specific weekdays, or N times per week; count goals with units; "build" and "quit" habits; notes per day; habit stacking; categories; archive.
- Streaks: current/best; skip (rest day) and streak-freeze (earned 1 per 25 completions, start with 2) preserve a streak without extending it; past days can be backfilled.
- Reminders: multiple per habit with times, days and a message; one-off tasks with due time and reminder; snooze 10 min.
- Insights: year heatmap, weekday rates, mood log and mood × completion, focus (Pomodoro) minutes, longest streaks.
- Gamification: XP, levels, 17 achievements.
- One React codebase for web (PWA) and Android (Capacitor); backend Node/Express/PostgreSQL. Self-hosted today (Docker), built to scale to multiple users later.
- Undecided: the public audience and any monetization.

## Brand Commitments

- Name: **HabitFlow**.
- Mood: **focused, motivated, a redemption arc** (confirmed by the owner). Character development is literal in the UI: attributes (Strength, Intellect, Vitality, Discipline, Presence) level up from completions, and Today counts the day of the arc.
- Voice: direct and coach-like, never cheesy; short sentences ("One left. Finish it.", "Recovery is part of the arc."); sentence case; errors say what happened and how to fix it.

## Evidence on Hand

- No real users, testimonials, press or usage statistics exist. Do not invent them.
- The development database was wiped on 2026-10-03; the owner starts fresh with their own account (Day 1 of the arc).

## Product Principles

1. A check-in takes one tap and under a few seconds; nothing stands between opening the app and marking a habit.
2. Progress is forgiving: missing a day costs something visible but recoverable.
3. Every reminder is actionable and respectful: it never nags about something already done.
4. Numbers tell the truth in plain words; no vanity metrics.
5. Personal first: no feature should assume a social or public audience until one is chosen.
