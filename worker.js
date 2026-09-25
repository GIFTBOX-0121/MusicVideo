const VIDEOS = [
  { title: "WISHES", id: "3gsVVVndUKM" },
  { title: "Moonchaser", id: "FTXk6epFQdM" },
  { title: "StarWish", id: "-Fhuw0VzelM" },
  { title: "USOTSUKI", id: "Nk3b5KnL4hg" },
  { title: "Drivin' My Life", id: "zbSQaKFjyXI" },
  { title: "Green Light", id: "FKtMzDOV08M" },
  { title: "Good Boys Anthem", id: "jK_uGTE66oo" },
  { title: "GOTH", id: "-PZ1eaqqb04" }
];


// ========================================
// STARGLOW公式YouTube
// RANDOM VIDEO用
// ========================================

const STARGLOW_YOUTUBE_HANDLE =
  "@starglow_bmsg";


// ========================================
// 集計開始日
// ========================================

const TRACKING_START_DATE =
  "2026-09-24";


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
// 共通レスポンスヘッダー
// ========================================

function getCorsHeaders() {
  return {
    "content-type":
      "application/json; charset=UTF-8",

    "access-control-allow-origin":
      "*",

    "access-control-allow-methods":
      "GET, POST, OPTIONS",

    "access-control-allow-headers":
      "Content-Type",

    "cache-control":
      "no-store"
  };
}


// ========================================
// YouTubeから現在値を取得
// ========================================

async function getYouTubeStats(env) {

  const ids =
    VIDEOS
      .map(v => v.id)
      .join(",");


  const url =
    "https://www.googleapis.com/youtube/v3/videos" +
    "?part=statistics" +
    "&id=" +
    encodeURIComponent(ids) +
    "&key=" +
    encodeURIComponent(
      env.YOUTUBE_API_KEY
    );


  const response =
    await fetch(url);


  if (!response.ok) {

    throw new Error(
      `YouTube API error: ${response.status}`
    );

  }


  const result =
    await response.json();


  const stats =
    Object.fromEntries(

      (result.items || [])
        .map(item => [

          item.id,

          {
            views:
              Number(
                item.statistics
                  ?.viewCount ?? 0
              ),

            likes:
              Number(
                item.statistics
                  ?.likeCount ?? 0
              )
          }

        ])

    );


  return VIDEOS.map(
    video => ({

      title:
        video.title,

      id:
        video.id,

      views:
        stats[video.id]
          ?.views ?? 0,

      likes:
        stats[video.id]
          ?.likes ?? 0

    })
  );
}


// ========================================
// YouTube 急上昇の音楽ランキング
// ========================================

async function getTrendingRanks(env) {

  const url =
    "https://www.googleapis.com/youtube/v3/videos" +
    "?part=id" +
    "&chart=mostPopular" +
    "&regionCode=JP" +
    "&videoCategoryId=10" +
    "&maxResults=50" +
    "&key=" +
    encodeURIComponent(
      env.YOUTUBE_API_KEY
    );


  try {

    const response =
      await fetch(url);


    if (!response.ok) {

      console.error(
        `YouTube trending API error: ${response.status}`
      );

      return {};
    }


    const result =
      await response.json();


    const ranks = {};


    (result.items || [])
      .forEach(
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

    return {};
  }
}


// ========================================
// STARGLOW公式チャンネルの
// UploadsプレイリストID取得
// ========================================

async function getStarglowUploadsPlaylistId(
  env
) {

  const url =
    "https://www.googleapis.com/youtube/v3/channels" +
    "?part=contentDetails" +
    "&forHandle=" +
    encodeURIComponent(
      STARGLOW_YOUTUBE_HANDLE
    ) +
    "&key=" +
    encodeURIComponent(
      env.YOUTUBE_API_KEY
    );


  const response =
    await fetch(url);


  if (!response.ok) {

    throw new Error(
      `YouTube channel API error: ${response.status}`
    );

  }


  const result =
    await response.json();


  const channel =
    result.items?.[0];


  const playlistId =
    channel
      ?.contentDetails
      ?.relatedPlaylists
      ?.uploads;


  if (!playlistId) {

    throw new Error(
      "STARGLOW uploads playlist not found"
    );

  }


  return playlistId;
}


// ========================================
// STARGLOW公式チャンネルの
// 公開動画を全部取得
//
// 通常動画＋Shorts
// ========================================

async function getStarglowVideos(env) {

  const playlistId =
    await getStarglowUploadsPlaylistId(
      env
    );


  const videos = [];


  let pageToken = "";


  do {

    let url =
      "https://www.googleapis.com/youtube/v3/playlistItems" +
      "?part=contentDetails,status" +
      "&playlistId=" +
      encodeURIComponent(
        playlistId
      ) +
      "&maxResults=50" +
      "&key=" +
      encodeURIComponent(
        env.YOUTUBE_API_KEY
      );


    if (pageToken) {

      url +=
        "&pageToken=" +
        encodeURIComponent(
          pageToken
        );

    }


    const response =
      await fetch(url);


    if (!response.ok) {

      throw new Error(
        `YouTube playlist API error: ${response.status}`
      );

    }


    const result =
      await response.json();


    for (
      const item of
      result.items || []
    ) {

      const videoId =
        item.contentDetails
          ?.videoId;


      const privacyStatus =
        item.status
          ?.privacyStatus;


      if (
        videoId &&
        privacyStatus === "public"
      ) {

        videos.push(
          videoId
        );

      }

    }


    pageToken =
      result.nextPageToken || "";


  } while (pageToken);


  return videos;
}


// ========================================
// STARGLOW公式から
// ランダムで1本選択
// ========================================

async function getRandomStarglowVideo(
  env
) {

  const videos =
    await getStarglowVideos(
      env
    );


  if (!videos.length) {

    throw new Error(
      "No public STARGLOW videos found"
    );

  }


  const randomIndex =
    Math.floor(
      Math.random() *
      videos.length
    );


  const videoId =
    videos[randomIndex];


  return {

    video_id:
      videoId,

    url:
      "https://www.youtube.com/watch?v=" +
      videoId

  };
}


// ========================================
// 10分ごとの現在値をvideo_statsへ保存
// ========================================

async function saveStats(
  env,
  videos
) {

  const recordedAt =
    new Date().toISOString();


  const statements =
    videos.map(
      video =>

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
        `)
        .bind(
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
// 約6時間前の記録
// ========================================

async function getSixHourBase(
  env,
  videoId
) {

  const sixHoursAgo =
    new Date(
      Date.now() -
      6 * 60 * 60 * 1000
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
      sixHoursAgo
    )
    .first();
}


// ========================================
// 今日の最初の記録
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
// 前日の正式な日次データ
// ========================================

async function getPreviousDailyStat(
  env,
  videoId
) {

  const today =
    getJstDate();


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

    ORDER BY jst_date DESC

    LIMIT 1
  `)
    .bind(
      videoId,
      TRACKING_START_DATE,
      today
    )
    .first();
}


// ========================================
// 過去の日別履歴
// ========================================

async function getDailyHistory(
  env
) {

  const result =
    await env.DB.prepare(`
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
    `)
      .bind(
        TRACKING_START_DATE
      )
      .all();


  return (
    result.results || []
  );
}


// ========================================
// 再生クリックを記録
// ========================================

async function savePlayClick(
  env,
  videoId
) {

  const video =
    VIDEOS.find(
      item =>
        item.id === videoId
    );


  if (!video) {

    throw new Error(
      "Invalid video ID"
    );

  }


  const clickedAt =
    new Date().toISOString();


  await env.DB.prepare(`
    INSERT INTO play_clicks
      (
        video_id,
        title,
        clicked_at
      )

    VALUES (?, ?, ?)
  `)
    .bind(
      video.id,
      video.title,
      clickedAt
    )
    .run();


  return {

    video_id:
      video.id,

    title:
      video.title,

    clicked_at:
      clickedAt

  };
}


// ========================================
// 最新の再生クリック6件
// ========================================

async function getRecentPlayClicks(
  env
) {

  const result =
    await env.DB.prepare(`
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
    `)
      .all();


  return (
    result.results || []
  );
}


// ========================================
// 終了した日のデータを
// daily_statsへ確定
// ========================================

async function finalizePastDays(
  env
) {

  const today =
    getJstDate();


  const result =
    await env.DB.prepare(`
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
    `)
      .bind(
        TRACKING_START_DATE,
        today
      )
      .all();


  const rows =
    result.results || [];


  if (
    rows.length === 0
  ) {
    return;
  }


  const statements =
    rows.map(
      row =>

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
        `)
          .bind(
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
            ) -
            Number(
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
            ) -
            Number(
              row.start_likes
            ),

            new Date()
              .toISOString()
          )

    );


  await env.DB.batch(
    statements
  );
}


// ========================================
// Worker
// ========================================

export default {

  // ======================================
  // サイトからアクセスされたとき
  // ======================================

  async fetch(
    request,
    env
  ) {

    const url =
      new URL(
        request.url
      );


    // ======================================
    // CORS
    // ======================================

    if (
      request.method ===
      "OPTIONS"
    ) {

      return new Response(
        null,
        {
          status: 204,

          headers:
            getCorsHeaders()
        }
      );

    }


    // ======================================
    // RANDOM VIDEO
    //
    // GET /random
    //
    // STARGLOW公式チャンネルの
    // 公開動画からランダムで1本
    //
    // DB保存なし
    // 再生履歴にも記録しない
    // ======================================

    if (
      url.pathname ===
        "/random" &&
      request.method ===
        "GET"
    ) {

      try {

        const randomVideo =
          await getRandomStarglowVideo(
            env
          );


        return new Response(
          JSON.stringify(
            randomVideo,
            null,
            2
          ),
          {
            headers:
              getCorsHeaders()
          }
        );


      } catch (error) {

        return new Response(
          JSON.stringify(
            {
              error:
                "Failed to get random video",

              message:
                error.message
            },
            null,
            2
          ),
          {
            status: 500,

            headers:
              getCorsHeaders()
          }
        );

      }

    }


    // ======================================
    // 再生クリック記録
    //
    // POST /play
    // ======================================

    if (
      url.pathname === "/play" &&
      request.method === "POST"
    ) {

      try {

        const body =
          await request.json();


        const videoId =
          body?.video_id;


        if (!videoId) {

          return new Response(
            JSON.stringify(
              {
                error:
                  "video_id is required"
              },
              null,
              2
            ),
            {
              status: 400,

              headers:
                getCorsHeaders()
            }
          );

        }


        const play =
          await savePlayClick(
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
            headers:
              getCorsHeaders()
          }
        );


      } catch (error) {

        return new Response(
          JSON.stringify(
            {
              error:
                "Failed to save play click",

              message:
                error.message
            },
            null,
            2
          ),
          {
            status: 400,

            headers:
              getCorsHeaders()
          }
        );

      }

    }


    // ======================================
    // 最新の再生クリック6件
    //
    // GET /recent-plays
    // ======================================

    if (
      url.pathname ===
        "/recent-plays" &&
      request.method ===
        "GET"
    ) {

      try {

        const plays =
          await getRecentPlayClicks(
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
            headers:
              getCorsHeaders()
          }
        );


      } catch (error) {

        return new Response(
          JSON.stringify(
            {
              error:
                "Failed to load recent plays",

              message:
                error.message
            },
            null,
            2
          ),
          {
            status: 500,

            headers:
              getCorsHeaders()
          }
        );

      }

    }


    // ======================================
    // 統計API
    // ======================================

    try {

      const [
        currentVideos,
        trendingRanks
      ] =
        await Promise.all([

          getYouTubeStats(
            env
          ),

          getTrendingRanks(
            env
          )

        ]);


      const videos = [];


      for (
        const video of
        currentVideos
      ) {

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
                  Number(
                    hourlyBase.views
                  ),

                likes:
                  video.likes -
                  Number(
                    hourlyBase.likes
                  )
              }
            : null;


        // ------------------------------
        // 6時間ペース
        // ------------------------------

        const sixHourBase =
          await getSixHourBase(
            env,
            video.id
          );


        let sixHourPace =
          null;


        if (sixHourBase) {

          const baseTime =
            new Date(
              sixHourBase
                .recorded_at
            ).getTime();


          const nowTime =
            Date.now();


          const hours =
            (
              nowTime -
              baseTime
            ) /
            (
              60 *
              60 *
              1000
            );


          const viewsChange =
            video.views -
            Number(
              sixHourBase.views
            );


          if (hours > 0) {

            sixHourPace = {

              views_change:
                viewsChange,

              hours:
                Number(
                  hours.toFixed(
                    3
                  )
                ),

              views_per_hour:
                Math.round(
                  viewsChange /
                  hours
                ),

              base_views:
                Number(
                  sixHourBase.views
                ),

              base_recorded_at:
                sixHourBase
                  .recorded_at
            };

          }

        }


        // ------------------------------
        // 今日トータル
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
                  Number(
                    todayBase.views
                  ),

                likes:
                  video.likes -
                  Number(
                    todayBase.likes
                  )
              }
            : null;


        // ------------------------------
        // 前日の正式な日次データ
        // ------------------------------

        const previousDay =
          await getPreviousDailyStat(
            env,
            video.id
          );


        // ------------------------------
        // 前日比
        // ------------------------------

        const previousDayComparison =
          (
            todayChange &&
            previousDay
          )
            ? {
                views:
                  Number(
                    todayChange.views
                  ) -
                  Number(
                    previousDay
                      .views_change
                  ),

                likes:
                  Number(
                    todayChange.likes
                  ) -
                  Number(
                    previousDay
                      .likes_change
                  )
              }
            : null;


        // ------------------------------
        // 前日の実績
        // ------------------------------

        const previousDayTotal =
          previousDay
            ? {
                date:
                  previousDay
                    .jst_date,

                views:
                  Number(
                    previousDay
                      .views_change
                  ),

                likes:
                  Number(
                    previousDay
                      .likes_change
                  )
              }
            : null;


        // ------------------------------
        // 急上昇順位
        // ------------------------------

        const trendingRank =
          trendingRanks[
            video.id
          ] ?? null;


        videos.push({

          title:
            video.title,

          id:
            video.id,

          views:
            video.views,

          likes:
            video.likes,

          trending_rank:
            trendingRank,

          hourly_change:
            hourlyChange,

          six_hour_pace:
            sixHourPace,

          today_change:
            todayChange,

          daily_change:
            previousDayComparison,

          previous_day_total:
            previousDayTotal

        });

      }


      // ------------------------------
      // 過去の日別履歴
      // ------------------------------

      const dailyHistory =
        await getDailyHistory(
          env
        );


      const data = {

        updated_at:
          new Date()
            .toISOString(),

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
          headers:
            getCorsHeaders()
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

          headers:
            getCorsHeaders()
        }
      );

    }

  },


  // ======================================
  // Cron
  //
  // 10分ごと
  // ======================================

  async scheduled(
    event,
    env,
    ctx
  ) {

    ctx.waitUntil(

      (async () => {

        // ------------------------------
        // YouTube現在値取得
        // ------------------------------

        const videos =
          await getYouTubeStats(
            env
          );


        // ------------------------------
        // 10分履歴へ保存
        // ------------------------------

        await saveStats(
          env,
          videos
        );


        // ------------------------------
        // 終了済みの日を
        // daily_statsへ確定
        // ------------------------------

        await finalizePastDays(
          env
        );

      })()

    );

  }

};