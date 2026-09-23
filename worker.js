const VIDEOS = [
  { title: "WISHES", id: "3gsVVVndUKM" },
  { title: "StarWish", id: "-Fhuw0VzelM" },
  { title: "USOTSUKI", id: "Nk3b5KnL4hg" },
  { title: "Drivin' My Life", id: "zbSQaKFjyXI" },
  { title: "Green Light", id: "FKtMzDOV08M" },
  { title: "Good Boys Anthem", id: "jK_uGTE66oo" }
];


// ========================================
// YouTubeから現在値を取得
// ========================================

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


// ========================================
// D1へ保存
// ========================================

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


// ========================================
// 約1時間前の記録を取得
// ========================================

async function getHourlyBase(env, videoId) {
  const oneHourAgo =
    new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const row = await env.DB.prepare(`
    SELECT
      views,
      likes,
      recorded_at
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


// ========================================
// 指定したJSTの日付の0:00付近を取得
// daysAgo = 0 → 今日0:00
// daysAgo = 1 → 昨日0:00
// ========================================

async function getJstMidnightBase(env, videoId, daysAgo) {
  const now = new Date();

  const jstNow =
    new Date(
      now.getTime() +
      9 * 60 * 60 * 1000
    );

  const year =
    jstNow.getUTCFullYear();

  const month =
    jstNow.getUTCMonth();

  const day =
    jstNow.getUTCDate() - daysAgo;


  // JST 00:00 → UTC
  const midnightUtc =
    new Date(
      Date.UTC(
        year,
        month,
        day,
        -9,
        0,
        0
      )
    );


  // 10分Cronの多少のズレを考慮
  // 00:00〜00:20 JSTの最初の記録を使用
  const limitUtc =
    new Date(
      midnightUtc.getTime() +
      20 * 60 * 1000
    );


  const row = await env.DB.prepare(`
    SELECT
      views,
      likes,
      recorded_at
    FROM video_stats
    WHERE video_id = ?
      AND recorded_at >= ?
      AND recorded_at <= ?
    ORDER BY recorded_at ASC
    LIMIT 1
  `)
    .bind(
      videoId,
      midnightUtc.toISOString(),
      limitUtc.toISOString()
    )
    .first();

  return row;
}


// ========================================
// 昨日1日で増えた数
//
// 昨日0:00 → 今日0:00
// ========================================

async function getPreviousDayChange(env, videoId) {

  const yesterdayBase =
    await getJstMidnightBase(
      env,
      videoId,
      1
    );

  const todayBase =
    await getJstMidnightBase(
      env,
      videoId,
      0
    );


  if (!yesterdayBase || !todayBase) {
    return null;
  }


  return {
    views:
      Number(todayBase.views) -
      Number(yesterdayBase.views),

    likes:
      Number(todayBase.likes) -
      Number(yesterdayBase.likes)
  };
}


// ========================================
// 日別推移
// 各日の最後の記録を1点として使用
// ========================================

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


// ========================================
// Worker
// ========================================

export default {

  // ======================================
  // サイトからアクセスされたとき
  // ======================================

  async fetch(request, env) {
    try {

      const currentVideos =
        await getYouTubeStats(env);

      const videos = [];


      for (const video of currentVideos) {

        const hourlyBase =
          await getHourlyBase(
            env,
            video.id
          );


        // ------------------------------
        // 1時間比
        // ------------------------------

        const hourlyChange =
          hourlyBase
            ? {
                views:
                  video.views -
                  Number(hourlyBase.views),

                likes:
                  video.likes -
                  Number(hourlyBase.likes)
              }
            : null;


        // ------------------------------
        // 前日1日分
        // 昨日0:00 → 今日0:00
        // ------------------------------

        const previousDayChange =
          await getPreviousDayChange(
            env,
            video.id
          );


        videos.push({
          title: video.title,
          id: video.id,

          views: video.views,
          likes: video.likes,

          hourly_change:
            hourlyChange,

          // index.htmlを変更しなくて済むよう
          // daily_changeという名前は維持
          daily_change:
            previousDayChange
        });
      }


      // ------------------------------
      // 6曲の日別推移
      // ------------------------------

      const dailyHistory =
        await getDailyHistory(env);


      const data = {
        updated_at:
          new Date().toISOString(),

        videos,

        daily_history:
          dailyHistory
      };


      return new Response(
        JSON.stringify(
          data,
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


  // ======================================
  // Cron
  // 10分ごとに自動保存
  // ======================================

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