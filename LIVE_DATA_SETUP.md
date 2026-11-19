# Live numbers: how they work and how to switch them on

## How it works

```
visitor's browser ──► live.js ──► /api/stats (Vercel function, keys stay private)
                                     ├─ YouTube Data API v3   (API key)
                                     └─ Instagram API          (access token)
                         └──fallback──► /data/stats.json (snapshot you can edit by hand)
```

- `live.js` updates every number on the page: the hero and section stats, Results counters,
  the story ring (top 5 across both platforms), and the YouTube and Instagram top-5 rails.
- `/api/stats` is cached at Vercel's edge for **15 minutes**, so the APIs are called at most
  about 100 times a day however many people visit. YouTube's free quota is 10,000 units a day;
  this uses about 4 per refresh.
- If a key is missing or an API is down, that platform falls back to `data/stats.json`.
  The page never shows an error. The Results section shows "Live · updated N min ago" with a
  green dot when data is live, and "Snapshot from …" otherwise.
- The last live answer is cached in each visitor's browser, so repeat visits show the newest
  numbers immediately.

## 1. YouTube key (10 minutes, free)

1. Go to https://console.cloud.google.com/ and create a project, e.g. "rblxanimates-site".
2. **APIs & Services → Library →** search for "YouTube Data API v3" and click **Enable**.
3. **APIs & Services → Credentials → Create credentials → API key.**
4. Click the new key, then under **API restrictions** choose **Restrict key** and tick only
   *YouTube Data API v3*. Save.
5. Add the key to Vercel. Either use the dashboard
   (vercel.com → 100x-labs → rblxanimates-site → Settings → Environment Variables →
   Name `YT_API_KEY`, Value = the key, Environment = Production), or in a terminal, from the
   site folder:
   ```bash
   vercel env add YT_API_KEY production
   ```
6. Redeploy (`vercel deploy --prod`, or push any commit to GitHub if the repo is connected).

## 2. Instagram token (about 20 minutes, free)

Your account needs to be a **Professional** account (Creator or Business). Yours is: it has a
professional dashboard.

1. Go to https://developers.facebook.com/ → **My Apps → Create app** → choose **Other**, then
   **Business**.
2. In the app, **Add product → Instagram → "API setup with Instagram login".**
3. Under **Generate access tokens**, add the @rblxanimates account and log in. Grant
   `instagram_business_basic` and `instagram_business_manage_insights`.
4. Copy the generated **long-lived token** (it lasts 60 days).
5. Add it to Vercel as `IG_ACCESS_TOKEN` (same steps as the YouTube key), then redeploy.

**The token expires after 60 days.** Refresh it any time before then (this returns a new
60-day token):
```bash
curl "https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=YOUR_TOKEN"
```
Then replace `IG_ACCESS_TOKEN` in Vercel with the new token and redeploy. Set a calendar
reminder for every 50 days.

While the Meta app stays in **Development** mode it can read accounts that have a role on the
app. You created it, so it can read yours, and you don't need App Review.

## 3. Check it

Open https://rblxanimates-site.vercel.app/api/stats. You should see `"source": "live"` and
real numbers. Anything wrong is spelled out in `"errors"`, for example
`"IG_ACCESS_TOKEN not set"` or the API's own message.

## Numbers the APIs can't give

- **YouTube "views in the last 7 days"** needs YouTube Analytics with an OAuth login, which a
  simple key can't do. The site shows channel views, subscribers, likes, comments and video
  count instead.
- **Instagram 30-day account views** come from the account-insights API and can differ
  slightly from what the app shows. Per-reel views and likes match the reels.

## Editing the snapshot by hand

`data/stats.json` is what visitors see when the APIs are off. Update the numbers in it, push to
GitHub and redeploy. Keep the same shape (the `top` lists hold up to 5 items each).
