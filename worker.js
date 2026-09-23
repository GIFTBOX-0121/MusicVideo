const VIDEOS = [
  { title: "WISHES", id: "3gsVVVndUKM" },
  { title: "StarWish", id: "-Fhuw0VzelM" },
  { title: "USOTSUKI", id: "Nk3b5KnL4hg" },
  { title: "Drivin' My Life", id: "zbSQaKFjyXI" },
  { title: "Green Light", id: "FKtMzDOV08M" },
  { title: "Good Boys Anthem", id: "jK_uGTE66oo" }
];

async function getYouTubeStats(env) {
  const ids = VIDEOS.map(v => v.id).join(",");

  const url =
    "https://www.googleapis.com/youtube/v3/videos" +
    "?part=statistics" +
    "&id=" + encodeURIComponent(ids) +
    "&key=" + encodeURIComponent(env.YOUTUBE_API_KEY);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`YouTube API error: ${response.status}`);
  }

  const result = await response.json();

  const stats = Object.fromEntries(
    (result.items || []).map(item => [
      item.id,
      {
        views: Number(item.statistics?.viewCount ?? 0),
        likes: Number(item.statistics?.likeCount ?? 0)
      }
    ])
  );

  return VIDEOS.map(video => ({
    title: video.title,
    id: video.id,
    views: stats[video.id]?.views ?? 0,
    likes: stats[video.id]?.likes ?? 0
  }));
}

async function saveStats(env, videos) {
  const recordedAt = new Date().toISOString();

  const statements = videos.map(video =>
    env.DB.prepare(`
      INSERT INTO video_stats
        (video_id, title, views, likes, recorded_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      video.id,
      video.title,
      video.views,
      video.likes,
      recordedAt
    )
  );

  await env.DB.batch(statements);
}


// ===============================
// 1時間前の基準値
// ===============================

async function getHourlyBase(env, videoId) {

  const oneHourAgo =
    new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const row = await env.DB.prepare(`
    SELECT views, likes, recorded_at
    FROM video_stats
    WHERE video_id = ?
      AND recorded_at <= ?
    ORDER BY recorded_at DESC
    LIMIT 1
  `)
    .bind(videoId, oneHourAgo)
    .first();

  return row;
}


// ===============================
// 今日0:00 JSTの基準値
// ===============================

async function getTodayBase(env, videoId) {

  const now = new Date();

  const jst = new Date(
    now.getTime() + 9 * 60 * 60 * 1000
  );

  const year = jst.getUTCFullYear();
  const month = jst.getUTCMonth();
  const day = jst.getUTCDate();

  // JST 00:00 → UTCへ変換
  const startUtc = new Date(
    Date.UTC(year, month, day, -9, 0, 0)
  );

  const row = await env.DB.prepare(`
    SELECT views, likes, recorded_at
    FROM video_stats
    WHERE video_id = ?
      AND recorded_at >= ?
    ORDER BY recorded_at ASC
    LIMIT 1
  `)
    .bind(videoId, startUtc.toISOString())
    .first();

  return row;
}


// ===============================
// 日別推移
// 各日の最後の記録を採用
// ===============================

async function getDailyHistory(env) {

  const result = await env.DB.prepare(`
    WITH ranked AS (
      SELECT
        video_id,
        title,
        views,
        likes,
        recorded_at,

        date(
          recorded_at,
          '+9 hours'
        ) AS jst_date,

        ROW_NUMBER() OVER (
          PARTITION BY
            video_id,
            date(recorded_at, '+9 hours')
          ORDER BY recorded_at DESC
        ) AS rn

      FROM video_stats
    )

    SELECT
      video_id,
      title,
      views,
      likes,
      recorded_at,
      jst_date

    FROM ranked
    WHERE rn = 1

    ORDER BY
      jst_date ASC,
      video_id ASC
  `).all();

  return result.results || [];
}


// ===============================
// API
// ===============================

export default {

  async fetch(request, env) {

    try {

      const currentVideos =
        await getYouTubeStats(env);

      const videos = [];

      for (const video of currentVideos) {

        const hourlyBase =
          await getHourlyBase(env, video.id);

        const todayBase =
          await getTodayBase(env, video.id);


        // 1時間比
        const hourly = hourlyBase
          ? {
              views:
                video.views -
                Number(hourlyBase.views),

              likes:
                video.likes -
                Number(hourlyBase.likes)
            }
          : null;


        // 前日比
        const daily = todayBase
          ? {
              views:
                video.views -
                Number(todayBase.views),

              likes:
                video.likes -
                Number(todayBase.likes)
            }
          : null;


        videos.push({
          title: video.title,
          id: video.id,

          views: video.views,
          likes: video.likes,

          hourly_change: hourly,
          daily_change: daily
        });
      }


      const history =
        await getDailyHistory(env);


      return new Response(
        JSON.stringify(
          {
            updated_at:
              new Date().toISOString(),

            videos,

            daily_history: history
          },
          null,
          2
        ),
        {
          headers: {
            "content-type":
              "application/json; charset=UTF-8",

            "access-control-allow-origin":
              "*",

            "cache-control":
              "no-store"
          }
        }
      );

    } catch (error) {

      return new Response(
        JSON.stringify(
          {
            error:
              "Failed to load statistics",

            message:
              error.message
          },
          null,
          2
        ),
        {
          status: 500,

          headers: {
            "content-type":
              "application/json; charset=UTF-8",

            "access-control-allow-origin":
              "*"
          }
        }
      );
    }
  },


  // ===============================
  // 10分ごとの自動記録
  // ===============================

  async scheduled(event, env, ctx) {

    ctx.waitUntil(
      (async () => {

        const videos =
          await getYouTubeStats(env);

        await saveStats(
          env,
          videos
        );

      })()
    );
  }
};