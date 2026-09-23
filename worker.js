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

  const statistics = Object.fromEntries(
    (result.items || []).map(item => [
      item.id,
      {
        views: Number(item.statistics.viewCount ?? 0),
        likes: Number(item.statistics.likeCount ?? 0)
      }
    ])
  );

  return VIDEOS.map(video => ({
    title: video.title,
    id: video.id,
    views: statistics[video.id]?.views ?? 0,
    likes: statistics[video.id]?.likes ?? 0
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

  return recordedAt;
}

export default {

  // ブラウザ・サイトから呼ばれた時
  async fetch(request, env) {
    try {
      const videos = await getYouTubeStats(env);

      return new Response(
        JSON.stringify({
          updated_at: new Date().toISOString(),
          videos
        }, null, 2),
        {
          headers: {
            "content-type": "application/json; charset=UTF-8",
            "access-control-allow-origin": "*",
            "cache-control": "no-store"
          }
        }
      );

    } catch (error) {
      return new Response(
        JSON.stringify({
          error: "Failed to fetch YouTube data"
        }),
        {
          status: 500,
          headers: {
            "content-type": "application/json; charset=UTF-8",
            "access-control-allow-origin": "*"
          }
        }
      );
    }
  },

  // Cronから自動実行された時
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      (async () => {
        const videos = await getYouTubeStats(env);
        await saveStats(env, videos);
      })()
    );
  }
};