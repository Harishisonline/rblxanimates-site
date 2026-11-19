// api/stats.js — Vercel serverless function: live channel numbers for the site.
//
// Keys stay on the server (Vercel → Project → Settings → Environment Variables):
//   YT_API_KEY        YouTube Data API v3 key (Google Cloud console)
//   YT_CHANNEL_ID     optional, defaults to the RBLX Animates channel
//   IG_ACCESS_TOKEN   Instagram API (Instagram Login) long-lived token for @rblxanimates
//   IG_API_VERSION    optional, e.g. "v23.0" (default)
//
// The browser calls /api/stats; Vercel's edge caches the answer for 15 minutes, so the APIs
// are hit at most ~100 times a day no matter how many people visit. Each platform is fetched
// independently: if one fails, the other still comes back, and the page keeps its snapshot
// numbers for the missing one.

const YT = "https://www.googleapis.com/youtube/v3";
const DEFAULT_CHANNEL = "UCWivubqiTUxHau9O0R_1Khg";

async function getJSON(url, ms = 8000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(body?.error?.message || `HTTP ${r.status}`);
    return body;
  } finally { clearTimeout(t); }
}
const num = (v) => (v == null ? null : Number(v));

// ---------------- YouTube (API key, public data) ----------------
async function youtube(key, channelId) {
  const ch = await getJSON(`${YT}/channels?part=statistics,contentDetails&id=${channelId}&key=${key}`);
  const c = ch.items?.[0];
  if (!c) throw new Error("channel not found");
  const uploads = c.contentDetails.relatedPlaylists.uploads;

  // every upload (paged), then stats in batches of 50
  const ids = []; let page = "";
  for (let i = 0; i < 6; i++) {
    const pl = await getJSON(`${YT}/playlistItems?part=contentDetails&maxResults=50&playlistId=${uploads}${page ? `&pageToken=${page}` : ""}&key=${key}`);
    pl.items?.forEach((it) => ids.push(it.contentDetails.videoId));
    if (!pl.nextPageToken) break; page = pl.nextPageToken;
  }
  const videos = [];
  for (let i = 0; i < ids.length; i += 50) {
    const v = await getJSON(`${YT}/videos?part=snippet,statistics&id=${ids.slice(i, i + 50).join(",")}&key=${key}`);
    v.items?.forEach((x) => videos.push({
      id: x.id,
      title: x.snippet.title,
      url: `https://www.youtube.com/shorts/${x.id}`,
      thumb: x.snippet.thumbnails?.maxres?.url || x.snippet.thumbnails?.high?.url || `https://i.ytimg.com/vi/${x.id}/hqdefault.jpg`,
      views: num(x.statistics.viewCount) || 0,
      likes: num(x.statistics.likeCount) || 0,
      comments: num(x.statistics.commentCount) || 0,
      publishedAt: x.snippet.publishedAt,
    }));
  }
  videos.sort((a, b) => b.views - a.views);
  return {
    subscribers: num(c.statistics.subscriberCount),
    views: num(c.statistics.viewCount),
    videos: num(c.statistics.videoCount),
    likes: videos.reduce((s, v) => s + v.likes, 0),
    comments: videos.reduce((s, v) => s + v.comments, 0),
    top: videos.slice(0, 5),
  };
}

// ---------------- Instagram (Instagram API with Instagram Login) ----------------
async function instagram(token, ver) {
  const G = `https://graph.instagram.com/${ver}`;
  const me = await getJSON(`${G}/me?fields=user_id,username,followers_count,media_count&access_token=${token}`);

  const media = []; let next = `${G}/me/media?fields=id,caption,media_type,media_product_type,like_count,comments_count,permalink,thumbnail_url,media_url,timestamp&limit=50&access_token=${token}`;
  for (let i = 0; i < 4 && next; i++) { const m = await getJSON(next); media.push(...(m.data || [])); next = m.paging?.next || null; }

  // per-post views (the metric is "views" since 2025; older accounts may still answer "plays")
  async function views(id) {
    for (const metric of ["views", "plays"]) {
      try {
        const r = await getJSON(`${G}/${id}/insights?metric=${metric}&access_token=${token}`, 6000);
        const v = r.data?.[0]?.values?.[0]?.value ?? r.data?.[0]?.total_value?.value;
        if (v != null) return Number(v);
      } catch { /* try the next metric name */ }
    }
    return null;
  }
  const posts = await Promise.all(media.map(async (m) => ({
    id: m.id,
    title: (m.caption || "").split("\n")[0],
    url: m.permalink,
    thumb: m.thumbnail_url || m.media_url,
    views: await views(m.id),
    likes: m.like_count || 0,
    comments: m.comments_count || 0,
    publishedAt: m.timestamp,
    isVideo: m.media_type === "VIDEO" || m.media_product_type === "REELS",
  })));

  // account views: last 30 days vs the 30 before (for the growth figure)
  async function accountViews(sinceDays, untilDays) {
    const now = Math.floor(Date.now() / 1000), day = 86400;
    try {
      const r = await getJSON(`${G}/me/insights?metric=views&period=day&metric_type=total_value&since=${now - sinceDays * day}&until=${now - untilDays * day}&access_token=${token}`);
      return num(r.data?.[0]?.total_value?.value);
    } catch { return null; }
  }
  const [views30, viewsPrev] = await Promise.all([accountViews(30, 0), accountViews(60, 30)]);

  const ranked = posts.filter((p) => p.isVideo && p.views != null).sort((a, b) => b.views - a.views);
  return {
    followers: num(me.followers_count),
    posts: num(me.media_count),
    views30,
    growthPct: views30 != null && viewsPrev ? Math.round(((views30 - viewsPrev) / viewsPrev) * 100) : null,
    totalViews: ranked.length ? ranked.reduce((s, p) => s + p.views, 0) : null,
    likes: posts.reduce((s, p) => s + p.likes, 0),
    top: ranked.slice(0, 5).map(({ isVideo, ...p }) => p),
  };
}

module.exports = async (req, res) => {
  const out = { source: "live", updatedAt: new Date().toISOString(), errors: {} };
  const { YT_API_KEY, YT_CHANNEL_ID, IG_ACCESS_TOKEN, IG_API_VERSION } = process.env;

  const jobs = [];
  if (YT_API_KEY) jobs.push(youtube(YT_API_KEY, YT_CHANNEL_ID || DEFAULT_CHANNEL).then((d) => (out.youtube = d)).catch((e) => (out.errors.youtube = e.message)));
  else out.errors.youtube = "YT_API_KEY not set";
  if (IG_ACCESS_TOKEN) jobs.push(instagram(IG_ACCESS_TOKEN, IG_API_VERSION || "v23.0").then((d) => (out.instagram = d)).catch((e) => (out.errors.instagram = e.message)));
  else out.errors.instagram = "IG_ACCESS_TOKEN not set";
  await Promise.all(jobs);

  const any = out.youtube || out.instagram;
  if (!any) out.source = "unavailable"; // page keeps its snapshot; 200 so browsers don't log an error
  // cache good answers at the edge for 15 min; misses only briefly so a new key shows up fast
  res.setHeader("Cache-Control", any ? "public, s-maxage=900, stale-while-revalidate=86400" : "public, s-maxage=60");
  res.status(200).json(out);
};
