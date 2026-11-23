# Life of Pige: project context

Personal daily-activity tracker for Cameron, built phone-first. Single self-contained HTML file (vanilla JS, no framework, no build step). Hosted as a standalone site on GitHub Pages; data is saved in Firebase (Firestore + email/password sign-in). The old claude.ai Artifact (https://claude.ai/artifact/LqkiUahsWwYCXzR6F2ioTU) was the previous home; its data was migrated over.

## History
1. Started as a gamified Google Sheet (8 skills, XP, levels). Obsolete.
2. Rebuilt as an XP/level web dashboard. Scrapped.
3. Now a plain daily activity tracker. No XP, levels, or targets. Do not bring the game theme back.

## Files
- `index.html`: the whole app (source of truth). The Firebase web config sits in the `<script type="module">` at the bottom
- `icon-180.png`, `icon-512.png`: home-screen icons (pig snout on pink gradient); `manifest.webmanifest` makes it open full-screen from the home screen
- `sw.js`: service worker, only shows push notifications (no caching)
- `reminders/send.mjs` + `.github/workflows/reminders.yml`: streak reminders (see below)
- `firestore.rules`: database security rules, locked to the owner's UID only (paste into Firebase console → Firestore → Rules after any change)

## Look and feel
- Calm futuristic dark theme, warm pink accent `#ff6f9f`, warm dark background `#0d0810`, glass-like cards, plus pastel tiles (`PAL`: mint `#a9d6c9`, pink `#ffb3cc`, yellow `#f6dc8d`, lilac `#cdbdf0`, peach `#ffc9a8`, sky `#a8d4f0`) with dark text. Chosen design: "style C" (hybrid of dark theme + pastel tiles)
- Fonts: Orbitron (headings, numbers) + Rajdhani (body), from Google Fonts
- Colors with meaning: orange `#ffb454` for streaks, gold `#ffd45e` for PRs, red-tint for the streak warning
- Phone-first (iPhone, Safari). Safe-area padding is in place. Add to home screen from Safari (Share → Add to Home Screen); opens full-screen
- Units: lbs, miles, weeks start Monday. Page title/header: "Life of Pige"
- User prefers short responses

## Storage layer
Firebase JS SDK (v10.12.2, loaded from gstatic) in the module script at the bottom of `index.html`. Email/password auth (sign-up is turned off in Firebase and there is no Create account button; single user only); Firestore with offline cache. Data lives at `users/<uid>/<collection>/<docId>`. The module calls `startApp(col, email)`; `col(name)` returns an object with `.doc(id).set/update/delete` and `.onSnapshot(cb)`, where `cb` gets `{docs:[{id,data()}], fresh, changed}`. Seeding only happens once the server (not the offline cache) confirms `grp`, `act`, `cfg` are empty. Footer has Back up (downloads JSON of all collections) and Restore (two taps; replaces all data with a backup file). Backup format: `{app:"life-of-pige", v:1, exported, data:{<collection>:[{id,...fields}]}}`.

| Collection | Doc id | Fields |
|---|---|---|
| `grp` | `g0..g4` seeded, else `g<uid>` | `name`, `o` (sort order) |
| `act` | `a<g>_<i>` seeded, else `a<uid>` | `name`, `g` (group id), `o`, optional `auto:"sleep"`, optional `nt:true` (no time tracking) |
| `log` | `<YYYY-MM-DD>_<actId>` | `date`, `act`, `mins` (existence of the doc = done; mins may be 0) |
| `cfg` | `seeded` | `v:1` (first-run seed marker) |
| `sleep` | `<date>` | `hours` |
| `weight` | `<date>` | `lbs` |
| `pr` | `p<uid>` | run: `type:"run", date, dist (mi), secs, ts`. lift: `type:"lift", date, name, w (lbs), reps, ts` |
| `acct` | `c<uid>` | `name`, `kind:"asset"|"debt"`, `o` |
| `bal` | `<YYYY-MM>_<acctId>` | `m`, `acct`, `amt` |
| `goal` | `q<uid>` | `name`, `target`, `acct` ("" = manual), `manual`, `o` |
| `mood` | `<date>` | optional `m` (1–5), optional `note` (doc deleted when both empty) |

Old `events` collection from the XP version is unused. The app seeds defaults once, when `grp`, `act`, `cfg` are all empty: Fitness (Run, Lift), Practice (Drums, Songwriting, Intentional Game), Learning (Reading), Vitality (Creatine, Water goal, Hit sleep goal), Work (empty). "Hit sleep goal" has `auto:"sleep"`. Creatine and Water goal have `nt:true`.

## Streak reminders (Web Push, no paid plan)
- App: "🔔 Streak reminders" card at the bottom of the Today tab (after the calendar). Turn on asks for notification permission (iPhone needs iOS 16.4+ and the app opened from the home-screen icon), subscribes with the public VAPID key and saves `users/<uid>/push/main` = `{on, sub (JSON string), tz, hour, lastSent}`. `push` is not part of Back up/Restore
- GitHub Actions runs `reminders/send.mjs` hourly (minute 7). It reads Firestore with a service account, works out the local date/hour from `tz`, and once the hour is reached sends one notification if any streak is at risk (same rules as the app), then sets `lastSent`. Expired subscriptions (404/410) set `on:false`
- Secrets in GitHub (Settings → Secrets → Actions): `FIREBASE_SA` (service account JSON), `VAPID_PRIVATE`. Public VAPID key and owner UID are in the workflow file and `index.html`
- Manual test: Actions → Streak reminders → Run workflow (force = sends a test notification even if nothing is at risk)
- A keep-alive step re-enables the workflow each run so GitHub doesn't pause it after 60 days

## Views (bottom tab bar `#bnav`: Today | Trends | PRs | Recap | Finance; `VIEW` holds the current one)
The "LIFE OF PIGE" header shows only on Today; other tabs have a page title (`.pg`). Footer (signed in as, Back up, Restore, Sign out) sits under every tab.

**Today**
- "Today's progress" card: half-gauge (share of all tasks done on the open date, gold at 100%) with the day's mood face in the middle, tasks done and time logged under it. Date navigator in the card header (‹ date ›; tapping the date opens a date picker); "Back to today" when on another day
- "How's today?" mood card: 5 emoji faces (😫😕😐🙂😄, tap again to clear) plus an optional note (saves on blur; skips re-render while the note is focused)
- Red "last day to save your streak" box
- Group tiles (pastel, one per group): done/total, top current streak in that group, progress bar, ⚠️ when a task in it is at risk. Tapping a tile selects it (`GSEL`) and the checklist shows only that group. "Edit lists" shows all groups for editing
- Checklist: tap the box to mark done; "+ time" opens Hrs/Min. Edit lists: add, rename, move, delete groups and tasks (delete needs two taps), toggle ⏱ time per task. Per-task streak badge with warning
- Sleep and weight: two small cards with input + Save
- Month calendar (replaced the 17-week heatmap): `CM` = shown month, follows the open date; ‹ › change month; tap a day to open it

**Trends**
- Week/Month switch. Tiles: days active and time logged vs the same number of days last week/month
- "Per activity" list with ▲▼ vs last period (days done and time). Tasks without time (`nt` or auto) get a compact row with days only
- "Streaks & consistency" table: current streak, best-ever streak, days done in the last 30 (colored pill)
- Weight line graph (lbs)

**PRs**
- Current PRs as pastel tiles (running: longest, time, pace; one tile per lift). "+ Log run / + Log lift" switch (`PRF`) shows one form at a time. Log sorted by date with All/Runs/Lifts filters
- Runs log miles + min/sec. Lifts log movement, lbs, reps. Suggested movements: Pull ups, Push ups, Dumbbell bench press, Dumbbell curls, Lateral raises. Any other name works; names group case-insensitively
- Run PRs: longest distance, longest time, fastest pace (only runs of 1 mi or more). Lift PR: heaviest weight, reps break ties (weight 0 means most reps wins)
- Badges mark entries that were a PR when logged; 👑 marks the current record

**Recap**
- Week/Month toggle with arrows. Pastel tiles: days active, check-offs, time logged, PRs hit, plus avg sleep, avg mood, weight change and best day (most check-offs) when data exists. Compares with the same number of days in the previous period. Lists PRs hit

**Finance** (hidden behind a 🔒 Unhide button by default; re-locks when leaving the tab or reloading. This is not real security, no passcode)
- Accounts are Assets or Debts. Monthly checkpoint: enter each account's balance for a chosen month; empty boxes keep the previous value (carry-forward)
- Net worth tile (big), Assets and Debts tiles, line graph by month. 🔒 Hide button in the page header; the Finance tab icon shows 🔒/🔓. Savings goals link to an asset account or a manual amount, with progress bars (gold at 100%). Amounts are always shown once unhidden

## Rules and decisions (keep these)
- **Best streak:** longest chain ever under the same GAP rule (past chains count first to last done day; the current one counts through today)
- **Streak:** alive if done at least once every 3 days (`GAP=3`). A streak ends after 3 full days with nothing. The number counts days elapsed from the first day of the chain through today. Warning when the task was not done today, yesterday, or the day before
- **Hit sleep goal:** checks itself when logged sleep for that date is 8+ hours (`GOAL=8`), cannot be tapped manually
- **Calendar colors** by share of all tasks done that day: under 20% faint pink, up to 40% medium pink, up to 60% solid pink `#ff6f9f`, over 60% gold `#ffd45e`. Blank if none. Dashed outline = the open date
- Creatine and Water goal have no time tracking

## Removed on purpose (do not re-add unless asked)
XP, levels, skills, quick-log chips and duration scaling, PR progress graphs, Recap "By activity" card, "time per week" chart and weekly table, a hide/show amounts toggle on Finance.

## Known limits
- Reminders arrive up to ~30 min late (GitHub schedule delays)
- The GitHub repo is public (needed for free GitHub Pages), so the code and this file are visible to anyone. Data is private behind sign-in and the Firestore rules

## Implementation notes
- Re-rendering on snapshots would wipe typed input, so the Finance checkpoint skips re-render while one of its inputs is focused
- Tab/filter buttons use class `.tb`; the Week/Month toggle on Trends uses `.dp`. Don't mix them. Segmented switches are `.seg` wrappers around those buttons
- Elements with a CSS `display` rule need an explicit `[hidden]{display:none}` (see `#bnav`) and `.cols[hidden]`)
- **Desktop layout** lives only in `@media (min-width:1000px)` at the end of the CSS: bottom bar becomes a left sidebar (brand via `#bnav::before`, `#brand` hidden; sidebar + content are centered as one block, and short pages are centered vertically), and `.cols`/`.col` wrappers become grid columns (Today = 3 columns, Trends/PRs/Finance = 2, Recap tiles = 4 across). On phones the wrappers are plain blocks, so the phone look is unchanged. Rule: desktop tweaks must not change the phone view; check by comparing 390px-wide screenshots before/after
- Delete buttons use an `ARM` variable for tap-twice confirmation; ids are prefixed per kind (`a`, `g`, `p`, `c`, `q`)

## Ideas not built
Nutrition tracking, a PIN for Finance, logging a run on the PRs page also checking off "Run" on the dashboard.
