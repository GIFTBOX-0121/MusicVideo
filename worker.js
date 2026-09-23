const VIDEOS = [
  { title: "WISHES", id: "3gsVVVndUKM" },
  { title: "StarWish", id: "-Fhuw0VzelM" },
  { title: "USOTSUKI", id: "Nk3b5KnL4hg" },
  { title: "Drivin' My Life", id: "zbSQaKFjyXI" },
  { title: "Green Light", id: "FKtMzDOV08M" },
  { title: "Good Boys Anthem", id: "jK_uGTE66oo" }
];

export default {
  async fetch(request, env) {
    const ids = VIDEOS.map(v => v.id).join(",");

    const url =
      "https://www.googleapis.com/youtube/v3/videos" +
      "?part=statistics" +
      "&id=" + encodeURIComponent(ids) +
      "&key=" + encodeURIComponent(env.YOUTUBE_API_KEY);

    try {
      const response = await fetch(url);

      if (!response.ok) {
        return new Response(
          JSON.stringify({
            error: "YouTube API error",
            status: response.status
          }),
          {
            status: 502,
            headers: {
              "content-type": "application/json; charset=UTF-8",
              "access-control-allow-origin": "*"
            }
          }
        );
      }

      const result = await response.json();

      const counts = Object.fromEntries(
        (result.items || []).map(item => [
          item.id,
          Number(item.statistics.viewCount)
        ])
      );

      const data = {
        updated_at: new Date().toISOString(),
        videos: VIDEOS.map(video => ({
          title: video.title,
          id: video.id,
          views: counts[video.id] ?? 0
        }))
      };

      return new Response(JSON.stringify(data, null, 2), {
        headers: {
          "content-type": "application/json; charset=UTF-8",
          "access-control-allow-origin": "*",
          "cache-control": "no-store"
        }
      });

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
  }
};