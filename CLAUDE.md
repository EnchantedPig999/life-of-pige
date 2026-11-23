# Life of Pige: project context

Personal daily-activity tracker for Cameron, built phone-first. Single self-contained HTML file (vanilla JS, no framework, no build step). Hosted as a standalone site on GitHub Pages; data is saved in Firebase (Firestore + email/password sign-in). The old claude.ai Artifact (https://claude.ai/artifact/LqkiUahsWwYCXzR6F2ioTU) was the previous home; its data was migrated over.

## History
1. Started as a gamified Google Sheet (8 skills, XP, levels). Obsolete.
2. Rebuilt as an XP/level web dashboard. Scrapped.
3. Now a plain daily activity tracker. No XP, levels, or targets. Do not bring the game theme back.

## Files
- `index.html`: the whole app (source of truth). The Firebase web config sits in the `<script type="module">` at the bottom
- `icon-180.png`, `icon-512.png`: home-screen icons (pig snout on pink gradient); `manifest.webmanifest` makes it open full-screen from the home screen
- `firestore.rules`: database security rules, locked to the owner's UID only (paste into Firebase console → Firestore → Rules after any change)

## Look and feel
- Calm futuristic dark theme, warm pink accent `#ff6f9f`, warm dark background `#0d0810`, glass-like cards
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

Old `events` collection from the XP version is unused. The app seeds defaults once, when `grp`, `act`, `cfg` are all empty: Fitness (Run, Lift), Practice (Drums, Songwriting, Intentional Game), Learning (Reading), Vitality (Creatine, Water goal, Hit sleep goal), Work (empty). "Hit sleep goal" has `auto:"sleep"`. Creatine and Water goal have `nt:true`.

## Views (top menu: Dashboard | PRs | Recap | Finance)
**Dashboard**
- Date navigator (log or fix any past day), one entry per task per day
- Checklist grouped by editable groups. Tap the box to mark done; "+ time" opens Hrs/Min. "Edit lists" lets you add, rename, move, delete groups and tasks (delete needs two taps) and toggle ⏱ time per task
- Streak strip, plus a red "last day to save your streak" box and per-task warning
- Sleep hours and weight inputs (saved for the open date) plus a weight line graph (lbs)
- Trends: 17-week heatmap (tap a day to open it) and a "Per activity" list with Week/Month toggle. Tasks without time (`nt` or auto) get a compact row: name, streak, days done, no bar or timer

**PRs**
- Current PR cards at top (gold), log forms, log sorted by date with filters
- Runs log miles + min/sec. Lifts log movement, lbs, reps. Suggested movements: Pull ups, Push ups, Dumbbell bench press, Dumbbell curls, Lateral raises. Any other name works; names group case-insensitively
- Run PRs: longest distance, longest time, fastest pace (only runs of 1 mi or more). Lift PR: heaviest weight, reps break ties (weight 0 means most reps wins)
- Badges mark entries that were a PR when logged; 👑 marks the current record

**Recap**
- Week/Month toggle with arrows. Tiles: days active, check-offs, time logged, PRs hit, plus avg sleep and weight change when data exists. Compares with the same number of days in the previous period. Lists PRs hit

**Finance** (hidden behind a 🔒 Unhide button by default; re-locks when leaving the tab or reloading. This is not real security, no passcode)
- Accounts are Assets or Debts. Monthly checkpoint: enter each account's balance for a chosen month; empty boxes keep the previous value (carry-forward)
- Net worth = assets minus debts, with a line graph by month. Savings goals link to an asset account or a manual amount, with progress bars (gold at 100%). Amounts are always shown once unhidden

## Rules and decisions (keep these)
- **Streak:** alive if done at least once every 3 days (`GAP=3`). A streak ends after 3 full days with nothing. The number counts days elapsed from the first day of the chain through today. Warning when the task was not done today, yesterday, or the day before
- **Hit sleep goal:** checks itself when logged sleep for that date is 8+ hours (`GOAL=8`), cannot be tapped manually
- **Heatmap colors** by share of all tasks done that day: under 20% red `#e5484d`, up to 40% yellow `#e9dc4a`, up to 60% green `#3fb96b`, over 60% 🔥. Blank if none. Number shown in each square except 🔥. Legend is deliberately short so it fits the box
- Creatine and Water goal have no time tracking

## Removed on purpose (do not re-add unless asked)
XP, levels, skills, quick-log chips and duration scaling, PR progress graphs, Recap "By activity" card, "time per week" chart and weekly table, a hide/show amounts toggle on Finance.

## Known limits
- No push notifications (the page can't send them); streak warnings only show when the app is opened
- The GitHub repo is public (needed for free GitHub Pages), so the code and this file are visible to anyone. Data is private behind sign-in and the Firestore rules

## Implementation notes
- Re-rendering on snapshots would wipe typed input, so the Finance checkpoint skips re-render while one of its inputs is focused
- Tab/filter buttons use class `.tb`; the Week/Month toggle on the dashboard uses `.dp`. Don't mix them (a global toggle on `.dp` would clear the tab state)
- Delete buttons use an `ARM` variable for tap-twice confirmation; ids are prefixed per kind (`a`, `g`, `p`, `c`, `q`)

## Ideas not built
Consistency score and longest-ever streaks, "vs last week" comparisons on the dashboard, progress ring for today, mood or journal notes, nutrition tracking, a PIN for Finance, logging a run on the PRs page also checking off "Run" on the dashboard.
