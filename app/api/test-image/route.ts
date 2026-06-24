export async function GET() {
  const apiKey = process.env.GOOGLE_API_KEY
  const cx     = process.env.GOOGLE_SEARCH_ENGINE_ID

  if (!apiKey || !cx) {
    return Response.json({ error: "Missing GOOGLE_API_KEY or GOOGLE_SEARCH_ENGINE_ID" })
  }

  try {
    const query = encodeURIComponent("Spider-Man Balloon Arch Kit product")
    const url   = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${query}&searchType=image&num=3&safe=active`

    const res  = await fetch(url)
    const data = await res.json()

    return Response.json({
      status: res.status,
      totalResults: data.searchInformation?.totalResults,
      error: data.error ?? null,
      images: (data.items ?? []).map((item: any) => ({
        title: item.title,
        link:  item.link,
        mime:  item.mime,
      })),
    })
  } catch (err) {
    return Response.json({ error: String(err) })
  }
}
