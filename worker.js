var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker.js
var VIDEOS = [
  { title: "Aurora", id: "pEn9DmzsQJw" },
  { title: "Slam Dunk", id: "tFTeMdvyfBs" },
  { title: "WISHES", id: "3gsVVVndUKM" },
  { title: "Moonchaser", id: "FTXk6epFQdM" },
  { title: "StarWish", id: "-Fhuw0VzelM" },
  { title: "USOTSUKI", id: "Nk3b5KnL4hg" },
  { title: "Drivin' My Life", id: "zbSQaKFjyXI" },
  { title: "PIECES", id: "5dzBSPmQdL4" },
  { title: "Green Light", id: "FKtMzDOV08M" },
  { title: "Good Boys Anthem", id: "jK_uGTE66oo" },
  { title: "GOTH", id: "-PZ1eaqqb04" }
];
var STARGLOW_YOUTUBE_HANDLE = "@starglow_bmsg";
var TRACKING_START_DATE = "2026-09-24";
function getJstDate(date = /* @__PURE__ */ new Date()) {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }
  ).format(date);
}
__name(getJstDate, "getJstDate");
function getJstHourStartIso(date = /* @__PURE__ */ new Date()) {
  const parts = new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23"
    }
  ).formatToParts(date);
  const get = /* @__PURE__ */ __name((type) => parts.find(
    (part) => part.type === type
  )?.value || "", "get");
  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hour = get("hour");
  return (/* @__PURE__ */ new Date(
    `${year}-${month}-${day}T${hour}:00:00+09:00`
  )).toISOString();
}
__name(getJstHourStartIso, "getJstHourStartIso");
function getCorsHeaders() {
  return {
    "content-type": "application/json; charset=UTF-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "Content-Type",
    "cache-control": "no-store"
  };
}
__name(getCorsHeaders, "getCorsHeaders");
async function getYouTubeStats(env) {
  const ids = VIDEOS.map(
    (video) => video.id
  ).join(",");
  const url = "https://www.googleapis.com/youtube/v3/videos?part=statistics&id=" + encodeURIComponent(ids) + "&key=" + encodeURIComponent(
    env.YOUTUBE_API_KEY
  );
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `YouTube API error: ${response.status}`
    );
  }
  const result = await response.json();
  const stats = Object.fromEntries(
    (result.items || []).map(
      (item) => [
        item.id,
        {
          views: Number(
            item.statistics?.viewCount ?? 0
          ),
          likes: Number(
            item.statistics?.likeCount ?? 0
          )
        }
      ]
    )
  );
  if (VIDEOS.some(video => !Object.prototype.hasOwnProperty.call(stats, video.id))) {
    throw new Error("Incomplete YouTube statistics response");
  }
  return VIDEOS.map(
    (video) => ({
      title: video.title,
      id: video.id,
      views: stats[video.id]?.views ?? 0,
      likes: stats[video.id]?.likes ?? 0
    })
  );
}
__name(getYouTubeStats, "getYouTubeStats");
async function getTrendingRanks(env) {
  const url = "https://www.googleapis.com/youtube/v3/videos?part=id&chart=mostPopular&regionCode=JP&videoCategoryId=10&maxResults=50&key=" + encodeURIComponent(
    env.YOUTUBE_API_KEY
  );
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(
        `YouTube trending API error: ${response.status}`
      );
      return null;
    }
    const result = await response.json();
    const ranks = {};
    (result.items || []).forEach(
      (item, index) => {
        ranks[item.id] = index + 1;
      }
    );
    return ranks;
  } catch (error) {
    console.error(
      "Trending fetch failed:",
      error
    );
    return null;
  }
}
__name(getTrendingRanks, "getTrendingRanks");
async function getStarglowUploadsPlaylistId(env) {
  const url = "https://www.googleapis.com/youtube/v3/channels?part=contentDetails&forHandle=" + encodeURIComponent(
    STARGLOW_YOUTUBE_HANDLE
  ) + "&key=" + encodeURIComponent(
    env.YOUTUBE_API_KEY
  );
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `YouTube channel API error: ${response.status}`
    );
  }
  const result = await response.json();
  const channel = result.items?.[0];
  const playlistId = channel?.contentDetails?.relatedPlaylists?.uploads;
  if (!playlistId) {
    throw new Error(
      "STARGLOW uploads playlist not found"
    );
  }
  return playlistId;
}
__name(getStarglowUploadsPlaylistId, "getStarglowUploadsPlaylistId");
async function getStarglowVideos(env) {
  const playlistId = await getStarglowUploadsPlaylistId(
    env
  );
  const videos = [];
  let pageToken = "";
  do {
    let url = "https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails,status&playlistId=" + encodeURIComponent(
      playlistId
    ) + "&maxResults=50&key=" + encodeURIComponent(
      env.YOUTUBE_API_KEY
    );
    if (pageToken) {
      url += "&pageToken=" + encodeURIComponent(
        pageToken
      );
    }
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `YouTube playlist API error: ${response.status}`
      );
    }
    const result = await response.json();
    for (const item of result.items || []) {
      const videoId = item.contentDetails?.videoId;
      const privacyStatus = item.status?.privacyStatus;
      if (videoId && privacyStatus === "public") {
        videos.push(
          videoId
        );
      }
    }
    pageToken = result.nextPageToken || "";
  } while (pageToken);
  return videos;
}
__name(getStarglowVideos, "getStarglowVideos");
async function getRandomStarglowVideo(env) {
  const videos = await getStarglowVideos(
    env
  );
  if (!videos.length) {
    throw new Error(
      "No public STARGLOW videos found"
    );
  }
  const randomIndex = Math.floor(
    Math.random() * videos.length
  );
  const videoId = videos[randomIndex];
  return {
    video_id: videoId,
    url: "https://www.youtube.com/watch?v=" + videoId
  };
}
__name(getRandomStarglowVideo, "getRandomStarglowVideo");
async function saveStats(env, videos) {
  const recordedAt = (/* @__PURE__ */ new Date()).toISOString();
  const statements = videos.map(
    (video) => env.DB.prepare(`
          INSERT INTO video_stats
            (
              video_id,
              title,
              views,
              likes,
              recorded_at
            )

          VALUES (?, ?, ?, ?, ?)
        `).bind(
      video.id,
      video.title,
      video.views,
      video.likes,
      recordedAt
    )
  );
  await env.DB.batch(
    statements
  );
}
__name(saveStats, "saveStats");
async function getHourlyBase(env, videoId, asOf = new Date()) {
  const hourStartIso = getJstHourStartIso(asOf);
  const hourStartMs = new Date(
    hourStartIso
  ).getTime();
  const before = await env.DB.prepare(`
      SELECT
        views,
        likes,
        recorded_at

      FROM video_stats

      WHERE video_id = ?
        AND recorded_at <= ?

      ORDER BY
        recorded_at DESC

      LIMIT 1
    `).bind(
    videoId,
    hourStartIso
  ).first();
  const after = await env.DB.prepare(`
      SELECT
        views,
        likes,
        recorded_at

      FROM video_stats

      WHERE video_id = ?
        AND recorded_at >= ?

      ORDER BY
        recorded_at ASC

      LIMIT 1
    `).bind(
    videoId,
    hourStartIso
  ).first();
  if (before && after) {
    const beforeMs = new Date(
      before.recorded_at
    ).getTime();
    const afterMs = new Date(
      after.recorded_at
    ).getTime();
    if (beforeMs === afterMs) {
      return {
        views: Number(
          before.views
        ),
        likes: Number(
          before.likes
        ),
        recorded_at: hourStartIso
      };
    }
    const span = afterMs - beforeMs;
    if (span > 0 && span <= 30 * 60 * 1e3 && beforeMs <= hourStartMs && afterMs >= hourStartMs) {
      const ratio = (hourStartMs - beforeMs) / span;
      const estimatedViews = Number(
        before.views
      ) + (Number(
        after.views
      ) - Number(
        before.views
      )) * ratio;
      const estimatedLikes = Number(
        before.likes
      ) + (Number(
        after.likes
      ) - Number(
        before.likes
      )) * ratio;
      return {
        views: Math.round(
          estimatedViews
        ),
        likes: Math.round(
          estimatedLikes
        ),
        recorded_at: hourStartIso
      };
    }
  }
  if (before) {
    const beforeMs = new Date(
      before.recorded_at
    ).getTime();
    const gap = hourStartMs - beforeMs;
    if (gap >= 0 && gap <= 20 * 60 * 1e3) {
      return {
        views: Number(
          before.views
        ),
        likes: Number(
          before.likes
        ),
        recorded_at: before.recorded_at
      };
    }
  }
  if (after) {
    const afterMs = new Date(
      after.recorded_at
    ).getTime();
    const gap = afterMs - hourStartMs;
    if (gap >= 0 && gap <= 20 * 60 * 1e3) {
      return {
        views: Number(
          after.views
        ),
        likes: Number(
          after.likes
        ),
        recorded_at: after.recorded_at
      };
    }
  }
  return null;
}
__name(getHourlyBase, "getHourlyBase");
async function getSixHourBase(env, videoId, asOf = new Date()) {
  const sixHoursAgo = new Date(
    asOf.getTime() - 6 * 60 * 60 * 1e3
  ).toISOString();
  return await env.DB.prepare(`
    SELECT
      views,
      likes,
      recorded_at

    FROM video_stats

    WHERE video_id = ?
      AND recorded_at <= ?

    ORDER BY
      recorded_at DESC

    LIMIT 1
  `).bind(
    videoId,
    sixHoursAgo
  ).first();
}
__name(getSixHourBase, "getSixHourBase");
async function getTodayFirstRecord(env, videoId, asOf = new Date()) {
  const today = getJstDate(asOf);
  return await env.DB.prepare(`
    SELECT
      views,
      likes,
      recorded_at

    FROM video_stats

    WHERE video_id = ?

      AND date(
        recorded_at,
        '+9 hours'
      ) = ?

    ORDER BY
      recorded_at ASC

    LIMIT 1
  `).bind(
    videoId,
    today
  ).first();
}
__name(getTodayFirstRecord, "getTodayFirstRecord");
async function getPreviousDailyStat(env, videoId, asOf = new Date()) {
  const today = getJstDate(asOf);
  return await env.DB.prepare(`
    SELECT
      jst_date,
      start_views,
      end_views,
      views_change,
      start_likes,
      end_likes,
      likes_change

    FROM daily_stats

    WHERE video_id = ?
      AND jst_date >= ?
      AND jst_date < ?

    ORDER BY
      jst_date DESC

    LIMIT 1
  `).bind(
    videoId,
    TRACKING_START_DATE,
    today
  ).first();
}
__name(getPreviousDailyStat, "getPreviousDailyStat");
async function getDailyHistory(env) {
  const result = await env.DB.prepare(`
      SELECT
        video_id,
        title,
        jst_date,
        start_views,
        end_views,
        views_change,
        start_likes,
        end_likes,
        likes_change

      FROM daily_stats

      WHERE jst_date >= ?

      ORDER BY
        jst_date ASC,
        video_id ASC
    `).bind(
    TRACKING_START_DATE
  ).all();
  return result.results || [];
}
__name(getDailyHistory, "getDailyHistory");
async function savePlayClick(env, videoId) {
  const video = VIDEOS.find(
    (item) => item.id === videoId
  );
  if (!video) {
    throw new Error(
      "Invalid video ID"
    );
  }
  const clickedAt = (/* @__PURE__ */ new Date()).toISOString();
  await env.DB.prepare(`
    INSERT INTO play_clicks
      (
        video_id,
        title,
        clicked_at
      )

    VALUES (?, ?, ?)
  `).bind(
    video.id,
    video.title,
    clickedAt
  ).run();
  return {
    video_id: video.id,
    title: video.title,
    clicked_at: clickedAt
  };
}
__name(savePlayClick, "savePlayClick");
async function getRecentPlayClicks(env) {
  const result = await env.DB.prepare(`
      SELECT
        id,
        video_id,
        title,
        clicked_at

      FROM play_clicks

      ORDER BY
        clicked_at DESC,
        id DESC

      LIMIT 6
    `).all();
  return result.results || [];
}
__name(getRecentPlayClicks, "getRecentPlayClicks");
async function finalizePastDays(env) {
  const today = getJstDate();
  const result = await env.DB.prepare(`
      WITH raw AS (

        SELECT
          video_id,
          title,
          views,
          likes,
          recorded_at,

          date(
            recorded_at,
            '+9 hours'
          ) AS jst_date

        FROM video_stats

        WHERE
          date(
            recorded_at,
            '+9 hours'
          ) >= ?

          AND

          date(
            recorded_at,
            '+9 hours'
          ) < ?
      ),

      ranked AS (

        SELECT
          video_id,
          title,
          views,
          likes,
          recorded_at,
          jst_date,

          ROW_NUMBER() OVER (
            PARTITION BY
              video_id,
              jst_date

            ORDER BY
              recorded_at ASC
          ) AS first_rn,

          ROW_NUMBER() OVER (
            PARTITION BY
              video_id,
              jst_date

            ORDER BY
              recorded_at DESC
          ) AS last_rn

        FROM raw
      ),

      daily AS (

        SELECT
          video_id,

          MAX(title)
            AS title,

          jst_date,

          MAX(
            CASE
              WHEN first_rn = 1
              THEN views
            END
          ) AS start_views,

          MAX(
            CASE
              WHEN last_rn = 1
              THEN views
            END
          ) AS end_views,

          MAX(
            CASE
              WHEN first_rn = 1
              THEN likes
            END
          ) AS start_likes,

          MAX(
            CASE
              WHEN last_rn = 1
              THEN likes
            END
          ) AS end_likes

        FROM ranked

        GROUP BY
          video_id,
          jst_date
      )

      SELECT
        video_id,
        title,
        jst_date,
        start_views,
        end_views,
        start_likes,
        end_likes

      FROM daily

      ORDER BY
        jst_date ASC,
        video_id ASC
    `).bind(
    TRACKING_START_DATE,
    today
  ).all();
  const rows = result.results || [];
  if (rows.length === 0) {
    return;
  }
  const statements = rows.map(
    (row) => env.DB.prepare(`
          INSERT OR IGNORE INTO daily_stats
            (
              video_id,
              title,
              jst_date,

              start_views,
              end_views,
              views_change,

              start_likes,
              end_likes,
              likes_change,

              created_at
            )

          VALUES (
            ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?,
            ?
          )
        `).bind(
      row.video_id,
      row.title,
      row.jst_date,
      Number(
        row.start_views
      ),
      Number(
        row.end_views
      ),
      Number(
        row.end_views
      ) - Number(
        row.start_views
      ),
      Number(
        row.start_likes
      ),
      Number(
        row.end_likes
      ),
      Number(
        row.end_likes
      ) - Number(
        row.start_likes
      ),
      (/* @__PURE__ */ new Date()).toISOString()
    )
  );
  await env.DB.batch(
    statements
  );
}
__name(finalizePastDays, "finalizePastDays");
async function getStarsGoalTrackerData(env) {
  const ids = ["tFTeMdvyfBs", "zbSQaKFjyXI"];
  const hourlyResult = await env.DB.prepare(`
    WITH numbered AS (
      SELECT
        video_id,
        views,
        recorded_at,
        strftime('%Y-%m-%d %H', recorded_at, '+9 hours') AS jst_hour,
        ROW_NUMBER() OVER (
          PARTITION BY video_id, strftime('%Y-%m-%d %H', recorded_at, '+9 hours')
          ORDER BY recorded_at ASC
        ) AS rn
      FROM video_stats
      WHERE video_id IN (?, ?)
        AND recorded_at >= ?
        AND recorded_at < ?
    )
    SELECT video_id, jst_hour, views, recorded_at
    FROM numbered
    WHERE rn = 1
    ORDER BY video_id, jst_hour
  `).bind(
    ids[0],
    ids[1],
    "2026-11-02T15:00:00.000Z",
    "2026-11-16T11:15:00.000Z"
  ).all();
  const latestRows = await Promise.all(ids.map(
    (id) => env.DB.prepare(`
      SELECT views, recorded_at
      FROM video_stats
      WHERE video_id = ?
        AND recorded_at <= ?
      ORDER BY recorded_at DESC
      LIMIT 1
    `).bind(id, "2026-11-16T11:01:00.000Z").first()
  ));
  return {
    updated_at: (/* @__PURE__ */ new Date()).toISOString(),
    target_views: 3e6,
    deadline_jst: "2026-11-16T20:00:00+09:00",
    hourly_first: hourlyResult.results || [],
    latest: ids.map((video_id, i) => ({
      video_id,
      views: latestRows[i] ? Number(latestRows[i].views) : null,
      recorded_at: latestRows[i]?.recorded_at || null
    }))
  };
}
__name(getStarsGoalTrackerData, "getStarsGoalTrackerData");
async function getMvCompareHistory(env) {
  const ids = ["pEn9DmzsQJw", "tFTeMdvyfBs"];
  const series = await Promise.all(ids.map(async (id) => {
    const records = [];
    const pageSize = 500;
    let offset = 0;
    while (true) {
      const result = await env.DB.prepare(`
        SELECT views, recorded_at FROM video_stats
        WHERE video_id = ?
        ORDER BY recorded_at ASC
        LIMIT ? OFFSET ?
      `).bind(id, pageSize, offset).all();
      const rows = result.results || [];
      records.push(...rows.map((row) => ({
        recorded_at: row.recorded_at,
        views: Number(row.views)
      })));
      if (rows.length < pageSize) break;
      offset += rows.length;
    }
    return {
      video_id: id,
      first_recorded_at: records[0]?.recorded_at || null,
      records
    };
  }));
  return { updated_at: (/* @__PURE__ */ new Date()).toISOString(), series };
}
__name(getMvCompareHistory, "getMvCompareHistory");
var STP_HOUR = 36e5;
var STP_JST = 9 * STP_HOUR;
var STP_AURORA = "pEn9DmzsQJw";
var STP_PHASES = [
  { key: "first", start: Date.parse("2026-11-21T00:00:00+09:00"), end: Date.parse("2026-11-23T00:00:00+09:00"), goal: 2e6, basis: null, deadline: "2026-11-22T23:59:59+09:00" },
  { key: "tenmillion", start: Date.parse("2026-11-23T00:00:00+09:00"), end: Date.parse("2026-12-30T17:00:00+09:00"), goal: 1e7, basis: 2e6, deadline: "2026-12-30T17:00:00+09:00" }
];
var STP_MILESTONES = [
  { id: "pEn9DmzsQJw", name: "Aurora", emoji: "\u{1F30C}", minimum: 1e6 },
  { id: "tFTeMdvyfBs", name: "SlamDunk", emoji: "\u{1F3C0}", minimum: 1e6 },
  { id: "zbSQaKFjyXI", name: "Drivin' My Life", emoji: "\u{1F697}", minimum: 1e6 },
  { id: "FTXk6epFQdM", name: "Moonchaser", emoji: "\u{1F315}", minimum: 1e6 },
  { id: "-Fhuw0VzelM", name: "StarWish", emoji: "\u{1F4AB}", minimum: 1e6 },
  { id: "FKtMzDOV08M", name: "Green Light", emoji: "\u{1F6A5}", minimum: 3e6 },
  { id: "Nk3b5KnL4hg", name: "USOTSUKI", emoji: "\u{1F98B}", minimum: 6e6 }
];
var stpSchemaPromise = null;
async function stpSchema(env) {
  if (!stpSchemaPromise) {
    stpSchemaPromise = env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS starsbase_aurora_goal_hours (
        hour_start INTEGER PRIMARY KEY,
        phase TEXT NOT NULL,
        target_delta INTEGER NOT NULL,
        average_at_freeze REAL,
        baseline_views INTEGER NOT NULL,
        baseline_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `).run().catch((error) => {
      stpSchemaPromise = null;
      throw error;
    });
  }
  await stpSchemaPromise;
}
__name(stpSchema, "stpSchema");
function stpJstDate(ms) {
  return new Date(ms + STP_JST).toISOString().slice(0, 10);
}
__name(stpJstDate, "stpJstDate");
function stpJstDay(ms) {
  return Date.parse(stpJstDate(ms) + "T00:00:00+09:00");
}
__name(stpJstDay, "stpJstDay");
function stpJstHour(ms) {
  return Math.floor((ms + STP_JST) / STP_HOUR) % 24;
}
__name(stpJstHour, "stpJstHour");
function stpHourFloor(ms) {
  return Math.floor(ms / STP_HOUR) * STP_HOUR;
}
__name(stpHourFloor, "stpHourFloor");
function stpPhaseAt(ms) {
  return STP_PHASES.find((p) => ms >= p.start && ms < p.end) || null;
}
__name(stpPhaseAt, "stpPhaseAt");
async function stpLatest(env, id) {
  const row = await env.DB.prepare("SELECT views,recorded_at FROM video_stats WHERE video_id=? ORDER BY recorded_at DESC LIMIT 1").bind(id).first();
  return row ? { views: Number(row.views), recorded_at: row.recorded_at } : null;
}
__name(stpLatest, "stpLatest");
async function stpHourFirst(env, start) {
  const result = await env.DB.prepare(`
    WITH ranked AS (
      SELECT views,recorded_at, strftime('%Y-%m-%d %H',recorded_at,'+9 hours') AS hour_jst,
      ROW_NUMBER() OVER(PARTITION BY strftime('%Y-%m-%d %H',recorded_at,'+9 hours') ORDER BY recorded_at ASC) AS rn
      FROM video_stats WHERE video_id=? AND recorded_at>=?
    )
    SELECT hour_jst,views,recorded_at FROM ranked WHERE rn=1 ORDER BY hour_jst
  `).bind(STP_AURORA, new Date(start).toISOString()).all();
  const map = /* @__PURE__ */ new Map();
  for (const r of result.results || []) {
    const ms = Date.parse(r.hour_jst.replace(" ", "T") + ":00:00+09:00");
    if (Number.isFinite(ms)) map.set(ms, { views: Number(r.views), recorded_at: r.recorded_at });
  }
  return map;
}
__name(stpHourFirst, "stpHourFirst");
function stpHourAverage(hourMap, referenceDay) {
  const out = [];
  for (let h = 0; h < 24; h++) {
    const samples = [];
    for (let daysBack = 1; daysBack <= 9 && samples.length < 4; daysBack++) {
      const start = referenceDay - daysBack * 24 * STP_HOUR + h * STP_HOUR;
      const a = hourMap.get(start), b = hourMap.get(start + STP_HOUR);
      if (a && b && b.views >= a.views) samples.push(b.views - a.views);
    }
    out.push(samples.length ? samples.reduce((a, b) => a + b, 0) / samples.length : null);
  }
  return out;
}
__name(stpHourAverage, "stpHourAverage");
function stpWeight(avg, h) {
  const known = avg.filter((x) => Number.isFinite(x) && x > 0);
  const fallback = known.length ? known.reduce((a, b) => a + b, 0) / known.length : 1;
  return Math.max(1, Number.isFinite(avg[h]) && avg[h] > 0 ? avg[h] : fallback);
}
__name(stpWeight, "stpWeight");
function stpAllocate(need, slots, avg, fractions = null) {
  if (!slots.length) return /* @__PURE__ */ new Map();
  need = Math.max(0, Math.round(need));
  const weighted = slots.map((slot, i) => stpWeight(avg, stpJstHour(slot)) * (fractions ? fractions[i] : 1));
  const sum = weighted.reduce((a, b) => a + b, 0);
  const raw = weighted.map((w) => sum > 0 ? need * w / sum : need / slots.length);
  const values = raw.map(Math.floor);
  let extra = need - values.reduce((a, b) => a + b, 0);
  const remainders = raw.map((v, i) => ({ i, r: v - values[i] })).sort((a, b) => b.r - a.r || a.i - b.i);
  for (let k = 0; k < extra; k++) values[remainders[k].i]++;
  return new Map(slots.map((s, i) => [s, values[i]]));
}
__name(stpAllocate, "stpAllocate");
async function stpFrozen(env) {
  const result = await env.DB.prepare("SELECT hour_start,phase,target_delta,average_at_freeze,baseline_views,baseline_at FROM starsbase_aurora_goal_hours WHERE hour_start>=? AND hour_start<? ORDER BY hour_start").bind(STP_PHASES[0].start, STP_PHASES[1].end).all();
  return new Map((result.results || []).map((r) => [Number(r.hour_start), {
    phase: r.phase,
    target: Number(r.target_delta),
    average: r.average_at_freeze == null ? null : Number(r.average_at_freeze),
    baseline: Number(r.baseline_views),
    baseline_at: r.baseline_at
  }]));
}
__name(stpFrozen, "stpFrozen");
async function stpFreezeCurrent(env, latest, hourMap) {
  if (!latest) return;
  const now = Date.now(), hour = stpHourFloor(now), phase = latest.views >= 2e6 ? STP_PHASES[1] : stpPhaseAt(hour);
  if (!phase) return;
  const measured = Date.parse(latest.recorded_at);
  if (!(measured >= hour && measured <= now + 6e4)) return;
  const found = await env.DB.prepare("SELECT hour_start FROM starsbase_aurora_goal_hours WHERE hour_start=?").bind(hour).first();
  if (found) return;
  const avg = stpHourAverage(hourMap, stpJstDay(now));
  const remaining = [];
  for (let slot = hour; slot < phase.end; slot += STP_HOUR) remaining.push(slot);
  const fractions = remaining.map((slot, i) => i === 0 ? Math.max(1e-5, (slot + STP_HOUR - now) / STP_HOUR) : 1);
  const allocation = stpAllocate(phase.goal - latest.views, remaining, avg, fractions);
  await env.DB.prepare(`
    INSERT OR IGNORE INTO starsbase_aurora_goal_hours
      (hour_start,phase,target_delta,average_at_freeze,baseline_views,baseline_at,created_at)
    VALUES (?,?,?,?,?,?,?)
  `).bind(hour, phase.key, allocation.get(hour) || 0, avg[stpJstHour(hour)], latest.views, latest.recorded_at, (/* @__PURE__ */ new Date()).toISOString()).run();
}
__name(stpFreezeCurrent, "stpFreezeCurrent");
function stpProjection(now, latest, hourMap, frozen) {
  const result = /* @__PURE__ */ new Map();
  for (const [hour, record] of frozen) result.set(hour, record.target);
  const averageToday = stpHourAverage(hourMap, stpJstDay(now));
  const currentHour = stpHourFloor(now);
  for (const phase of STP_PHASES) {
    if (now >= phase.end) continue;
    if (latest?.views >= 2e6 && phase.key === "first") continue;
    const slots = [];
    const earlySwitch = phase.key === "tenmillion" && latest?.views >= 2e6;
    for (let slot = earlySwitch ? currentHour + STP_HOUR : phase.start; slot < phase.end; slot += STP_HOUR) {
      if (slot > currentHour && !frozen.has(slot)) slots.push(slot);
    }
    let need = 0;
    if (now < phase.start && !earlySwitch) need = phase.goal - phase.basis;
    else if (latest) {
      const current = frozen.get(currentHour);
      const actualThisHour = current ? Math.max(0, latest.views - current.baseline) : 0;
      const pending = current ? Math.max(0, current.target - actualThisHour) : 0;
      need = Math.max(0, phase.goal - latest.views - pending);
    }
    const allocations = stpAllocate(need, slots, averageToday);
    for (const [hour, delta] of allocations) result.set(hour, delta);
  }
  return result;
}
__name(stpProjection, "stpProjection");
async function stpMidnightSnapshots(env, now) {
  const lower = new Date(STP_PHASES[0].start - 20 * 6e4).toISOString();
  const upper = new Date(now + 20 * 6e4).toISOString();
  const result = await env.DB.prepare(`
    SELECT views,recorded_at FROM video_stats
    WHERE video_id=? AND recorded_at>=? AND recorded_at<=?
      AND (strftime('%H:%M',recorded_at,'+9 hours')>='23:40'
        OR strftime('%H:%M',recorded_at,'+9 hours')<='00:20')
    ORDER BY recorded_at ASC
  `).bind(STP_AURORA, lower, upper).all();
  const near = /* @__PURE__ */ new Map();
  for (const row of result.results || []) {
    const ms = Date.parse(row.recorded_at);
    if (!Number.isFinite(ms)) continue;
    const date = stpJstDay(ms);
    const midnight = stpJstHour(ms) === 23 ? date + 24 * STP_HOUR : date;
    if (midnight < STP_PHASES[0].start || midnight > now) continue;
    const gap = ms - midnight;
    if (Math.abs(gap) > 20 * 6e4) continue;
    if (!near.has(midnight)) near.set(midnight, { before: null, after: null });
    const pair = near.get(midnight);
    const entry = { views: Number(row.views), ms };
    if (gap <= 0 && (!pair.before || pair.before.ms < ms)) pair.before = entry;
    if (gap >= 0 && (!pair.after || pair.after.ms > ms)) pair.after = entry;
  }
  const resultMap = /* @__PURE__ */ new Map();
  for (const [midnight, { before, after }] of near) {
    let views = null;
    if (before && after) {
      const span = after.ms - before.ms;
      if (span === 0) views = after.views;
      else if (span <= 30 * 6e4) views = Math.round(before.views + (after.views - before.views) * (midnight - before.ms) / span);
    }
    if (views === null && after) views = after.views;
    if (views === null && before) views = before.views;
    if (views !== null && Number.isFinite(views)) resultMap.set(midnight, Math.max(0, views));
  }
  return resultMap;
}
__name(stpMidnightSnapshots, "stpMidnightSnapshots");
function stpDailyPlans(hourly, midnights, now, detailed, activePhase) {
  const result = /* @__PURE__ */ new Map();
  const currentDay = stpJstDay(now);
  const startingDay = detailed ? STP_PHASES[0].start : currentDay;
  for (let day = startingDay; day <= currentDay; day += 24 * STP_HOUR) {
    const phase = day === currentDay ? activePhase : stpPhaseAt(day);
    if (!phase) continue;
    const midnight = midnights.get(day) ?? hourly.get(day)?.views ?? null;
    if (midnight === null) continue;
    const averages = stpHourAverage(hourly, day);
    const future = [];
    for (let slot = day; slot < phase.end; slot += STP_HOUR) future.push(slot);
    const all = stpAllocate(phase.goal - midnight, future, averages);
    const today = /* @__PURE__ */ new Map();
    let dailyTarget = 0;
    for (let t = day; t < Math.min(day + 24 * STP_HOUR, phase.end); t += STP_HOUR) {
      const goal = all.get(t) || 0;
      today.set(t, goal);
      dailyTarget += goal;
    }
    result.set(day, { baseline: midnight, dailyTarget, hours: today });
  }
  return result;
}
__name(stpDailyPlans, "stpDailyPlans");
async function stpCore(env, detailed) {
  await stpSchema(env);
  const now = Date.now();
  const latest = await stpLatest(env, STP_AURORA);
  const hourly = await stpHourFirst(env, detailed ? Date.parse("2026-11-16T00:00:00+09:00") : stpJstDay(now) - 10 * 24 * STP_HOUR);
  await stpFreezeCurrent(env, latest, hourly);
  const frozen = await stpFrozen(env);
  const projected = stpProjection(now, latest, hourly, frozen);
  const phase = latest?.views >= 2e6 ? STP_PHASES[1] : stpPhaseAt(now) || (now >= STP_PHASES[1].end ? STP_PHASES[1] : STP_PHASES[0]);
  const day = stpJstDay(now);
  const snapshots = await stpMidnightSnapshots(env, now);
  const dayPlans = stpDailyPlans(hourly, snapshots, now, detailed, phase);
  const plan = dayPlans.get(day);
  const midnight = plan?.baseline ?? null;
  const dailyTarget = plan?.dailyTarget ?? null;
  const complete = !!plan;
  const dailyActual = latest && midnight !== null ? Math.max(0, latest.views - midnight) : null;
  const summary = {
    now: new Date(now).toISOString(),
    video_id: STP_AURORA,
    views: latest?.views ?? null,
    recorded_at: latest?.recorded_at ?? null,
    phase: phase.key,
    goal: phase.goal,
    deadline_jst: phase.deadline,
    daily_target: dailyTarget,
    daily_actual: dailyActual,
    daily_partial: !complete,
    day_start_views: midnight,
    remaining: latest ? Math.max(0, phase.goal - latest.views) : null
  };
  if (!detailed) return { summary };
  const rows = [];
  for (let t = STP_PHASES[0].start; t < STP_PHASES[1].end; t += STP_HOUR) {
    const dayStart = stpJstDay(t);
    const avg = stpHourAverage(hourly, Math.min(dayStart, stpJstDay(now)))[stpJstHour(t)];
    const fixed = frozen.get(t);
    const beginning = hourly.get(t), ending = hourly.get(t + STP_HOUR);
    const previousStart = hourly.get(t - 24 * STP_HOUR);
    const previousEnd = hourly.get(t - 23 * STP_HOUR);
    const previousDayActual = previousStart && previousEnd && previousEnd.views >= previousStart.views ? previousEnd.views - previousStart.views : null;
    let actual = null, state = "future";
    if (t + STP_HOUR <= now) {
      if (fixed && ending) actual = Math.max(0, ending.views - fixed.baseline);
      else if (beginning && ending) actual = Math.max(0, ending.views - beginning.views);
      state = "complete";
    } else if (t <= now && latest) {
      if (fixed) actual = Math.max(0, latest.views - fixed.baseline);
      else if (beginning) actual = Math.max(0, latest.views - beginning.views);
      state = "active";
    }
    rows.push({
      date: stpJstDate(t),
      hour: stpJstHour(t),
      phase: dayPlans.has(dayStart) ? dayStart === day ? phase.key : stpPhaseAt(t)?.key || "" : "",
      average: fixed?.average ?? avg,
      previous_day_actual: previousDayActual,
      goal: dayPlans.get(dayStart)?.hours.get(t) ?? (projected.has(t) ? projected.get(t) : null),
      actual,
      state,
      locked: !!fixed
    });
  }
  return { summary, rows };
}
__name(stpCore, "stpCore");
async function stpProgress(env) {
  const [tracker, latestItems] = await Promise.all([
    stpCore(env, false),
    Promise.all(STP_MILESTONES.map((x) => stpLatest(env, x.id)))
  ]);
  const midnight = stpJstDay(Date.now());
  const around = await env.DB.prepare(`
    SELECT video_id,views,recorded_at FROM video_stats
    WHERE recorded_at>=? AND recorded_at<=? ORDER BY recorded_at ASC
  `).bind(new Date(midnight - 20 * 6e4).toISOString(), new Date(midnight + 20 * 6e4).toISOString()).all();
  const candidates = /* @__PURE__ */ new Map();
  for (const r of around.results || []) {
    if (!STP_MILESTONES.some((s) => s.id === r.video_id)) continue;
    if (!candidates.has(r.video_id)) candidates.set(r.video_id, []);
    candidates.get(r.video_id).push(r);
  }
  const graduationCutoff = "2026-11-22T08:29:00.000Z";
  const graduationRows = await env.DB.prepare(`
    SELECT s.video_id,s.views FROM video_stats s
    INNER JOIN (
      SELECT video_id,MAX(recorded_at) AS last_recorded
      FROM video_stats WHERE recorded_at<=?
      GROUP BY video_id
    ) q ON s.video_id=q.video_id AND s.recorded_at=q.last_recorded
  `).bind(graduationCutoff).all();
  const graduationViews = new Map((graduationRows.results || []).map((r) => [r.video_id, Number(r.views)]));
  const fixedGoals = {
    "zbSQaKFjyXI": 3e6,
    "FKtMzDOV08M": 3e6,
    "Nk3b5KnL4hg": 6e6
  };
  const milestones = STP_MILESTONES.map((song, i) => {
    const latest = latestItems[i], views = latest?.views ?? null;
    const historic = graduationViews.get(song.id);
    const frozen = Number.isFinite(historic) ? Math.max(song.minimum, (Math.floor(historic / 1e6) + 1) * 1e6) : null;
    const goal = song.id === "pEn9DmzsQJw" ? views === null ? null : Math.max(song.minimum, (Math.floor(views / 1e6) + 1) * 1e6) : fixedGoals[song.id] ?? frozen;
    const base = goal === null ? null : Math.max(0, goal - 1e6);
    const samples = candidates.get(song.id) || [];
    let before = null, after = null;
    for (const s of samples) {
      if (Date.parse(s.recorded_at) <= midnight) before = s;
      else if (!after) after = s;
    }
    let dayStart = null;
    if (before && after) {
      const t1 = Date.parse(before.recorded_at), t2 = Date.parse(after.recorded_at);
      dayStart = Math.round(Number(before.views) + (Number(after.views) - Number(before.views)) * (midnight - t1) / (t2 - t1));
    } else if (after) dayStart = Number(after.views);
    else if (before) dayStart = Number(before.views);
    if (dayStart !== null && views !== null) dayStart = Math.min(dayStart, views);
    return {
      id: song.id,
      name: song.name,
      emoji: song.emoji,
      views,
      goal,
      base,
      graduated: song.id !== "pEn9DmzsQJw" && goal !== null && views !== null && views >= goal,
      day_start_views: dayStart,
      today_delta: dayStart !== null && views !== null ? Math.max(0, views - dayStart) : null
    };
  });
  return { ...tracker, milestones };
}
__name(stpProgress, "stpProgress");

// STARS BASE: scheduled-only statistics and persistent ranking cache.
async function readSavedCounter(env) {
  const rows = await env.DB.prepare(`
    SELECT video_id, views, likes, recorded_at FROM video_stats
    WHERE recorded_at = (SELECT MAX(recorded_at) FROM video_stats)
  `).all();
  const byId = new Map((rows.results || []).map(row => [row.video_id, row]));
  const videos = VIDEOS.filter(video => byId.has(video.id)).map(video => {
    const row = byId.get(video.id);
    return { ...video, views: Number(row.views), likes: Number(row.likes),
      recorded_at: row.recorded_at };
  });
  if (!videos.length) throw new Error("No saved statistics available");
  return { videos, recorded_at: videos[0].recorded_at };
}
async function ensureCounterRankCache(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS starsbase_counter_rank_cache (
    id INTEGER PRIMARY KEY, ranks_json TEXT NOT NULL, recorded_at TEXT NOT NULL
  )`).run();
}
async function readSavedRanks(env) {
  try {
    await ensureCounterRankCache(env);
    const row = await env.DB.prepare(
      "SELECT ranks_json FROM starsbase_counter_rank_cache WHERE id=1"
    ).first();
    return row ? JSON.parse(row.ranks_json) : {};
  } catch (error) {
    console.error("Saved ranking read:", error);
    return {};
  }
}
async function refreshSavedRanks(env) {
  const ranks = await getTrendingRanks(env);
  if (ranks === null) return;
  await ensureCounterRankCache(env);
  await env.DB.prepare(`INSERT INTO starsbase_counter_rank_cache
    (id,ranks_json,recorded_at) VALUES (1,?,?)
    ON CONFLICT(id) DO UPDATE SET ranks_json=excluded.ranks_json,
      recorded_at=excluded.recorded_at`)
    .bind(JSON.stringify(ranks), new Date().toISOString()).run();
}

var worker_default = {
  // ======================================
  // サイトからアクセスされたとき
  // ======================================
  async fetch(request, env) {
    const url = new URL(
      request.url
    );
    if (request.method === "OPTIONS") {
      return new Response(
        null,
        {
          status: 204,
          headers: getCorsHeaders()
        }
      );
    }
    if (url.pathname === "/random" && request.method === "GET") {
      try {
        const randomVideo = await getRandomStarglowVideo(
          env
        );
        return new Response(
          JSON.stringify(
            randomVideo,
            null,
            2
          ),
          {
            headers: getCorsHeaders()
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify(
            {
              error: "Failed to get random video",
              message: error.message
            },
            null,
            2
          ),
          {
            status: 500,
            headers: getCorsHeaders()
          }
        );
      }
    }
    if (url.pathname === "/play" && request.method === "POST") {
      try {
        const body = await request.json();
        const videoId = body?.video_id;
        if (!videoId) {
          return new Response(
            JSON.stringify(
              {
                error: "video_id is required"
              },
              null,
              2
            ),
            {
              status: 400,
              headers: getCorsHeaders()
            }
          );
        }
        const play = await savePlayClick(
          env,
          videoId
        );
        return new Response(
          JSON.stringify(
            {
              success: true,
              play
            },
            null,
            2
          ),
          {
            headers: getCorsHeaders()
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify(
            {
              error: "Failed to save play click",
              message: error.message
            },
            null,
            2
          ),
          {
            status: 400,
            headers: getCorsHeaders()
          }
        );
      }
    }
    if (url.pathname === "/recent-plays" && request.method === "GET") {
      try {
        const plays = await getRecentPlayClicks(
          env
        );
        return new Response(
          JSON.stringify(
            {
              plays
            },
            null,
            2
          ),
          {
            headers: getCorsHeaders()
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify(
            {
              error: "Failed to load recent plays",
              message: error.message
            },
            null,
            2
          ),
          {
            status: 500,
            headers: getCorsHeaders()
          }
        );
      }
    }
    if (url.pathname === "/stars-progress" && request.method === "GET") {
      try {
        const result = await stpProgress(env);
        return new Response(JSON.stringify(result), { headers: getCorsHeaders() });
      } catch (error) {
        console.error("STARS progress:", error);
        return new Response(JSON.stringify({ error: "Progress unavailable" }), { status: 500, headers: getCorsHeaders() });
      }
    }
    if (url.pathname === "/aurora-target-tracker" && request.method === "GET") {
      try {
        const result = await stpCore(env, true);
        return new Response(JSON.stringify(result), { headers: getCorsHeaders() });
      } catch (error) {
        console.error("Aurora goals:", error);
        return new Response(JSON.stringify({ error: "Aurora tracker unavailable" }), { status: 500, headers: getCorsHeaders() });
      }
    }
    if (url.pathname === "/goal-tracker" && request.method === "GET") {
      try {
        const goalData = await getStarsGoalTrackerData(env);
        return new Response(JSON.stringify(goalData), {
          headers: getCorsHeaders()
        });
      } catch (error) {
        console.error("Goal tracker read error:", error);
        return new Response(JSON.stringify({ error: "Goal tracker unavailable" }), {
          status: 500,
          headers: getCorsHeaders()
        });
      }
    }
    if (url.pathname === "/mv-compare-history" && request.method === "GET") {
      try {
        const data = await getMvCompareHistory(env);
        return new Response(JSON.stringify(data), { headers: getCorsHeaders() });
      } catch (error) {
        console.error("MV compare history error:", error);
        return new Response(JSON.stringify({ error: "MV compare history unavailable" }), {
          status: 500,
          headers: getCorsHeaders()
        });
      }
    }
    try {
      const [snapshot, trendingRanks] = await Promise.all([
        readSavedCounter(env), readSavedRanks(env)
      ]);
      const currentVideos = snapshot.videos;
      const measuredAt = new Date(snapshot.recorded_at);
      if (!Array.isArray(currentVideos)) {
        throw new Error("YouTube statistics must be an array");
      }
      const videos = [];
      for (const video of currentVideos) {
        const hourlyBase = await getHourlyBase(
          env,
          video.id,
          measuredAt
        );
        const hourlyChange = hourlyBase ? {
          views: video.views - Number(
            hourlyBase.views
          ),
          likes: video.likes - Number(
            hourlyBase.likes
          )
        } : null;
        const sixHourBase = await getSixHourBase(
          env,
          video.id,
          measuredAt
        );
        let sixHourPace = null;
        if (sixHourBase) {
          const baseTime = new Date(
            sixHourBase.recorded_at
          ).getTime();
          const nowTime = measuredAt.getTime();
          const hours = (nowTime - baseTime) / (60 * 60 * 1e3);
          const viewsChange = video.views - Number(
            sixHourBase.views
          );
          if (hours > 0) {
            sixHourPace = {
              views_change: viewsChange,
              hours: Number(
                hours.toFixed(
                  3
                )
              ),
              views_per_hour: Math.round(
                viewsChange / hours
              ),
              base_views: Number(
                sixHourBase.views
              ),
              base_recorded_at: sixHourBase.recorded_at
            };
          }
        }
        const todayBase = await getTodayFirstRecord(
          env,
          video.id,
          measuredAt
        );
        const todayChange = todayBase ? {
          views: video.views - Number(
            todayBase.views
          ),
          likes: video.likes - Number(
            todayBase.likes
          )
        } : null;
        const previousDay = await getPreviousDailyStat(
          env,
          video.id,
          measuredAt
        );
        const previousDayComparison = todayChange && previousDay ? {
          views: Number(
            todayChange.views
          ) - Number(
            previousDay.views_change
          ),
          likes: Number(
            todayChange.likes
          ) - Number(
            previousDay.likes_change
          )
        } : null;
        const previousDayTotal = previousDay ? {
          date: previousDay.jst_date,
          views: Number(
            previousDay.views_change
          ),
          likes: Number(
            previousDay.likes_change
          )
        } : null;
        const trendingRank = trendingRanks[video.id] ?? null;
        videos.push({
          title: video.title,
          id: video.id,
          views: video.views,
          likes: video.likes,
          trending_rank: trendingRank,
          hourly_change: hourlyChange,
          six_hour_pace: sixHourPace,
          today_change: todayChange,
          daily_change: previousDayComparison,
          previous_day_total: previousDayTotal
        });
      }
      const dailyHistory = await getDailyHistory(
        env
      );
      const data = {
        updated_at: snapshot.recorded_at,
        videos,
        daily_history: dailyHistory
      };
      return new Response(
        JSON.stringify(
          data,
          null,
          2
        ),
        {
          headers: getCorsHeaders()
        }
      );
    } catch (error) {
      return new Response(
        JSON.stringify(
          {
            error: "Failed to load statistics",
            message: error.message
          },
          null,
          2
        ),
        {
          status: 500,
          headers: getCorsHeaders()
        }
      );
    }
  },
  // ======================================
  // Cron
  //
  // 10分ごと
  // ======================================
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      (async () => {
        const [statsSaved] = await Promise.all([
          (async () => {
            try {
              const videos = await getYouTubeStats(env);
              await saveStats(env, videos);
              return true;
            } catch (error) {
              console.error("Scheduled statistics refresh:", error);
              return false;
            }
          })(),
          refreshSavedRanks(env).catch(error => console.error("Scheduled ranking refresh:", error))
        ]);
        if (!statsSaved) return;
        await finalizePastDays(
          env
        );
        try {
          await stpCore(env, false);
        } catch (error) {
          console.error("Aurora goal freeze:", error);
        }
      })()
    );
  }
};
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map
