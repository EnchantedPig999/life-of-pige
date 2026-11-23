// Streak reminders. Runs hourly on GitHub Actions (.github/workflows/reminders.yml).
// Reads the owner's data from Firestore with a service account, and sends a Web Push
// notification once a day, at the hour chosen in the app, if any streak is about to end.
// Streak rules mirror index.html: GAP=3, sleep goal GOAL=8, "at risk" = streak alive but
// not done today, yesterday or the day before.
import crypto from "node:crypto";
import webpush from "web-push";

const SA = JSON.parse(process.env.FIREBASE_SA || "{}");
const UID = process.env.OWNER_UID;
const PROJECT = SA.project_id;
const FORCE = process.env.FORCE === "true";
const GAP = 3, GOAL = 8;
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/users/${UID}`;
const SITE = "https://enchantedpig999.github.io/life-of-pige/";

if (!SA.private_key || !UID || !process.env.VAPID_PRIVATE || !process.env.VAPID_PUBLIC) {
  console.error("Missing FIREBASE_SA, OWNER_UID, VAPID_PUBLIC or VAPID_PRIVATE");
  process.exit(1);
}

// ---- Google access token from the service account (JWT bearer flow) ----
async function token() {
  const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: "RS256", typ: "JWT" });
  const body = b64({ iss: SA.client_email, scope: "https://www.googleapis.com/auth/datastore", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 });
  const sig = crypto.createSign("RSA-SHA256").update(head + "." + body).sign(SA.private_key, "base64url");
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${body}.${sig}` }) });
  const j = await r.json();
  if (!j.access_token) throw new Error("Token error: " + JSON.stringify(j));
  return j.access_token;
}
const TOKEN = await token();
const H = { authorization: "Bearer " + TOKEN };

// ---- Firestore REST helpers ----
const val = v => v == null ? null : "stringValue" in v ? v.stringValue : "integerValue" in v ? Number(v.integerValue) : "doubleValue" in v ? v.doubleValue : "booleanValue" in v ? v.booleanValue : null;
const flat = d => { const o = { id: d.name.split("/").pop() }; for (const [k, v] of Object.entries(d.fields || {})) o[k] = val(v); return o; };
async function list(col) {
  const out = []; let page = "";
  do {
    const r = await fetch(`${BASE}/${col}?pageSize=300${page ? "&pageToken=" + page : ""}`, { headers: H });
    const j = await r.json(); if (j.error) throw new Error(col + ": " + j.error.message);
    (j.documents || []).forEach(d => out.push(flat(d))); page = j.nextPageToken || "";
  } while (page);
  return out;
}
async function patch(col, id, fields) {
  const mask = Object.keys(fields).map(k => "updateMask.fieldPaths=" + k).join("&");
  const f = {}; for (const [k, v] of Object.entries(fields)) f[k] = typeof v === "boolean" ? { booleanValue: v } : { stringValue: String(v) };
  await fetch(`${BASE}/${col}/${id}?${mask}`, { method: "PATCH", headers: { ...H, "content-type": "application/json" }, body: JSON.stringify({ fields: f }) });
}

const push = (await list("push")).find(d => d.id === "main");
if (!push || !push.on || !push.sub) { console.log("Reminders are off."); process.exit(0); }

// ---- Local date/hour in the phone's time zone ----
const tz = push.tz || "America/New_York";
const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date()).map(p => [p.type, p.value]));
const TODAY = `${parts.year}-${parts.month}-${parts.day}`, HOUR = Number(parts.hour), WANT = push.hour ?? 19;
console.log(`Local ${TODAY} ${HOUR}:00 (${tz}); reminder hour ${WANT}; last sent ${push.lastSent || "never"}`);
if (!FORCE && (HOUR < WANT || push.lastSent === TODAY)) { console.log("Not time yet, or already sent today."); process.exit(0); }

// ---- Streaks (same rules as the app) ----
const addD = (s, n) => { const d = new Date(s + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const diff = (a, b) => Math.round((new Date(a + "T12:00:00Z") - new Date(b + "T12:00:00Z")) / 864e5);
const [acts, logs, sleep] = await Promise.all([list("act"), list("log"), list("sleep")]);
const L = new Set(logs.map(l => l.id)), SL = Object.fromEntries(sleep.map(s => [s.id, s.hours]));
const done = (a, d) => a.auto === "sleep" ? (SL[d] != null && SL[d] >= GOAL) : L.has(d + "_" + a.id);
const streak = a => { let d = TODAY, g = 0, f = null; if (!done(a, d)) d = addD(d, -1); for (let i = 0; i < 3650; i++) { if (done(a, d)) { f = d; g = 0 } else if (++g >= GAP) break; d = addD(d, -1) } return f ? diff(TODAY, f) + 1 : 0; };
const risk = acts.map(a => ({ a, k: streak(a) })).filter(x => x.k > 0 && !done(x.a, TODAY) && !done(x.a, addD(TODAY, -1)) && !done(x.a, addD(TODAY, -2))).sort((x, y) => y.k - x.k);

let msg = null;
if (risk.length) msg = { title: `⚠️ Last day to save ${risk.length === 1 ? "your streak" : risk.length + " streaks"}`, body: risk.map(x => `${x.a.name} 🔥${x.k}`).join(", ") + ". Do it today or it resets.", url: SITE };
else if (FORCE) msg = { title: "🐷 Reminders are working", body: "This is a test. You'll only get these when a streak is about to end.", url: SITE };
if (!msg) { console.log("No streaks at risk today."); await patch("push", "main", { lastSent: TODAY }); process.exit(0); }

// ---- Send ----
console.log("Message:", msg.title, "-", msg.body);
webpush.setVapidDetails(SITE, process.env.VAPID_PUBLIC, process.env.VAPID_PRIVATE);
try {
  await webpush.sendNotification(JSON.parse(push.sub), JSON.stringify(msg), { TTL: 6 * 3600 });
  console.log("Sent:", msg.title);
  await patch("push", "main", { lastSent: TODAY });
} catch (e) {
  console.error("Push failed:", e.statusCode, e.body || e.message);
  if (e.statusCode === 404 || e.statusCode === 410) { await patch("push", "main", { on: false }); console.log("Subscription expired; turned reminders off. Turn them on again in the app."); }
  process.exit(1);
}
