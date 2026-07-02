# Sync Apple Watch steps & workouts to your tracker

Your tracker now has an endpoint that accepts daily health data. Apple doesn't
offer a web API for HealthKit, so we use an iPhone Shortcut that reads your
Health data and posts it to the app every evening. Setup takes about 10 minutes.

## One-time server setup

1. Pick a long random secret — this is your personal sync token. For example,
   run this in any terminal: `openssl rand -hex 24`, or just mash out 40+
   random characters.
2. In Vercel → your project → Settings → Environment Variables, add:
   - `HEALTH_SYNC_TOKEN` = the secret from step 1
   - `HEALTH_SYNC_USER_ID` = your Supabase user id (Supabase dashboard →
     Authentication → Users → copy the UUID next to your email)
   - `SUPABASE_SERVICE_ROLE_KEY` = from Supabase → Settings → API (if you
     haven't already added it for share links)
3. Run `supabase/migrations/0010_health_days.sql` in the Supabase SQL Editor.
4. Redeploy the app so the new env vars take effect.

## Build the Shortcut (on your iPhone)

Open the **Shortcuts** app → **+** to create a new shortcut, then add these
actions in order:

1. **Find Health Samples** — sample type: **Steps**, Start Date: **Today at
   00:00**, group by day, calculate **Sum**. (Search for "Find Health Samples"
   in the actions list.)
2. **Find Health Samples** again — sample type: **Active Energy**, same
   settings, Sum.
3. *(Optional)* **Find Workouts** — filter: **Today**, to include workouts.
4. **Get Contents of URL** — this is the action that sends the data:
   - URL: `https://calories-tracker-test.vercel.app/api/health-sync`
   - Method: **POST**
   - Headers: add one header —
     - Key: `Authorization`
     - Value: `Bearer YOUR_TOKEN_HERE` (paste your secret after the word
       "Bearer" and a space)
   - Request Body: **JSON**, with these fields:

```json
{
  "date": "2026-07-02",
  "steps": 8432,
  "active_kcal": 512,
  "workouts": [
    { "type": "Running", "duration_min": 32, "kcal": 310 }
  ]
}
```

   In the Shortcuts editor, replace each value with the magic variable from
   the earlier actions: tap the value field → select the variable — `date` =
   **Current Date** (formatted `yyyy-MM-dd`), `steps` = the Sum from action 1,
   `active_kcal` = the Sum from action 2. If you skipped workouts, send
   `"workouts": []`.

5. Name the shortcut something like **"Sync health to tracker"** and run it
   once manually — you should get back `{"ok": true, ...}`.

## Automate it (daily at 10pm)

1. Shortcuts app → **Automation** tab → **+** → **Time of Day**.
2. Set **10:00 PM**, repeat **Daily**, and choose **Run Immediately** (so it
   doesn't ask for confirmation).
3. Action: **Run Shortcut** → pick "Sync health to tracker".

That's it. Every night at 10pm your steps, active calories, and workouts land
in the app, and the **Activity** card on your dashboard shows them the next
time you open it. You can also run the shortcut manually any time — sending
the same date twice just updates that day's numbers.

## Troubleshooting

- **401 Unauthorized** — the Authorization header doesn't match
  `HEALTH_SYNC_TOKEN`. Check for a missing `Bearer ` prefix or a trailing
  space.
- **503 Health sync is not configured** — one of the env vars isn't set in
  Vercel, or you haven't redeployed since adding them.
- **400** — the JSON body is malformed; check the `date` is `yyyy-MM-dd` and
  steps/active_kcal are plain numbers.
