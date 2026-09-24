const VIDEOS = [
  { title: "WISHES", id: "3gsVVVndUKM" },
  { title: "StarWish", id: "-Fhuw0VzelM" },
  { title: "USOTSUKI", id: "Nk3b5KnL4hg" },
  { title: "Drivin' My Life", id: "zbSQaKFjyXI" },
  { title: "Green Light", id: "FKtMzDOV08M" },
  { title: "Good Boys Anthem", id: "jK_uGTE66oo" }
];


// ========================================
// JSTの日付を取得
// ========================================

function getJstDate(date = new Date()) {
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
    throw new Error(
      `YouTube API error: ${response.status}`
    );
  }

  const result = await response.json();

  const stats = Object.fromEntries(
    (result.items || []).map(item => [
      item.id,
      {
        views:
          Number(item.statistics?.viewCount ?? 0),

        likes:
          Number(item.statistics?.likeCount ?? 0)
      }
    ])
  );

  return VIDEOS.map(video => ({
    title: video.title,
    id: video.id,

    views:
      stats[video.id]?.views ?? 0,

    likes:
      stats[video.id]?.likes ?? 0
  }));
}


// ========================================
// YouTube 急上昇の音楽ランキング
//
// 日本 / 音楽カテゴリ / mostPopular
// 上位50件から対象MVを探す
// ========================================

async function getTrendingRanks(env) {

  const url =
    "https://www.googleapis.com/youtube/v3/videos" +
    "?part=id" +
    "&chart=mostPopular" +
    "&regionCode=JP" +
    "&videoCategoryId=10" +
    "&maxResults=50" +
    "&key=" + encodeURIComponent(env.YOUTUBE_API_KEY);


  try {

    const response = await fetch(url);

    if (!response.ok) {
      console.error(
        `YouTube trending API error: ${response.status}`
      );

      // 急上昇取得だけ失敗しても
      // STARS BASE本体は止めない
      return {};
    }


    const result =
      await response.json();


    const ranks = {};


    (result.items || []).forEach(
      (item, index) => {

        ranks[item.id] =
          index + 1;

      }
    );


    return ranks;

  } catch (error) {

    console.error(
      "Trending fetch failed:",
      error
    );

    // 急上昇取得だけ失敗しても
    // 他のデータは通常表示
    return {};
  }
}


// ========================================
// 10分ごとの現在値をvideo_statsへ保存
// ========================================

async function saveStats(env, videos) {
  const recordedAt = new Date().toISOString();

  const statements = videos.map(video =>
    env.DB.prepare(`
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

  await env.DB.batch(statements);
}


// ========================================
// 約1時間前の記録
// ========================================

async function getHourlyBase(
  env,
  videoId
) {
  const oneHourAgo =
    new Date(
      Date.now() -
      60 * 60 * 1000
    ).toISOString();

  return await env.DB.prepare(`
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
    .bind(
      videoId,
      oneHourAgo
    )
    .first();
}


// ========================================
// 今日の最初の記録
//
// TODAYの増加数を出すために使用
// ========================================

async function getTodayFirstRecord(
  env,
  videoId
) {
  const today =
    getJstDate();

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

    ORDER BY recorded_at ASC

    LIMIT 1
  `)
    .bind(
      videoId,
      today
    )
    .first();
}


// ========================================
// 前日の日次データを取得
// ========================================

async function getPreviousDailyStat(
  env,
  videoId
) {
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

    ORDER BY jst_date DESC

    LIMIT 1
  `)
    .bind(videoId)
    .first();
}


// ========================================
// 過去の日別履歴
//
// daily_statsだけを読む
// ========================================

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

    ORDER BY
      jst_date ASC,
      video_id ASC
  `).all();

  return result.results || [];
}


// ========================================
// 終了した日のデータをdaily_statsへ確定
//
// 今日より前で、まだdaily_statsに存在しない日を
// video_statsから日次データへ圧縮
//
// ※まだvideo_statsは削除しない
// ========================================

async function finalizePastDays(env) {
  const today =
    getJstDate();

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

      WHERE date(
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

        MAX(title) AS title,

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
  `)
    .bind(today)
    .all();


  const rows =
    result.results || [];


  if (rows.length === 0) {
    return;
  }


  const statements =
    rows.map(row =>
      env.DB.prepare(`
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

        Number(row.start_views),
        Number(row.end_views),

        Number(row.end_views) -
        Number(row.start_views),

        Number(row.start_likes),
        Number(row.end_likes),

        Number(row.end_likes) -
        Number(row.start_likes),

        new Date().toISOString()
      )
    );


  await env.DB.batch(statements);
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

      // 現在値と急上昇を並行取得
      const [
        currentVideos,
        trendingRanks
      ] = await Promise.all([
        getYouTubeStats(env),
        getTrendingRanks(env)
      ]);


      const videos = [];


      for (const video of currentVideos) {

        // ------------------------------
        // 1時間比
        // ------------------------------

        const hourlyBase =
          await getHourlyBase(
            env,
            video.id
          );


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
        // TODAY
        // ------------------------------

        const todayBase =
          await getTodayFirstRecord(
            env,
            video.id
          );


        const todayChange =
          todayBase
            ? {
                views:
                  video.views -
                  Number(todayBase.views),

                likes:
                  video.likes -
                  Number(todayBase.likes)
              }
            : null;


        // ------------------------------
        // 前日の確定値
        // ------------------------------

        const previousDay =
          await getPreviousDailyStat(
            env,
            video.id
          );


        const previousDayChange =
          previousDay
            ? {
                views:
                  Number(
                    previousDay.views_change
                  ),

                likes:
                  Number(
                    previousDay.likes_change
                  )
              }
            : null;


        // ------------------------------
        // 急上昇順位
        //
        // ランク外なら null
        // ------------------------------

        const trendingRank =
          trendingRanks[video.id] ?? null;


        videos.push({
          title:
            video.title,

          id:
            video.id,

          views:
            video.views,

          likes:
            video.likes,

          // ★ 急上昇を復活
          // index.htmlがこの名前を見ている
          trending_rank:
            trendingRank,

          hourly_change:
            hourlyChange,

          // 既存index.htmlとの互換性
          daily_change:
            previousDayChange,

          today_change:
            todayChange
        });
      }


      // ------------------------------
      // 過去の日別履歴
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
  //
  // 10分ごと
  // ======================================

  async scheduled(event, env, ctx) {

    ctx.waitUntil(
      (async () => {

        // ------------------------------
        // ① YouTube現在値取得
        // ------------------------------

        const videos =
          await getYouTubeStats(env);


        // ------------------------------
        // ② 現在値を10分履歴へ保存
        // ------------------------------

        await saveStats(
          env,
          videos
        );


        // ------------------------------
        // ③ 終了済みの日を
        // daily_statsへ確定
        //
        // ※古い10分履歴はまだ削除しない
        // ------------------------------

        await finalizePastDays(env);

      })()
    );
  }
};
