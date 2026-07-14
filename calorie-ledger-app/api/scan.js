// Vercel serverless function: POST { image: base64Jpeg } -> food estimate JSON
// Keeps the Anthropic API key server-side. Set ANTHROPIC_API_KEY in your
// Vercel project's environment variables (same pattern as Pathfinder's chat.ts).

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { image } = req.body || {};
  if (!image) {
    res.status(400).json({ error: "Missing image" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Server missing ANTHROPIC_API_KEY" });
    return;
  }

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system:
          'You are a nutrition expert estimating calories from a food photo. Respond ONLY with raw JSON, no markdown fences, no preamble, matching exactly this shape: {"food_name": string (short, e.g. "Grilled chicken salad"), "items": string[] (list of visible components), "portion_note": string (brief portion size assessment), "estimated_calories": number, "confidence": "low"|"medium"|"high"}. Make your best realistic estimate even if uncertain — never refuse.',
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: "image/jpeg", data: image } },
              { type: "text", text: "Identify this food and estimate total calories." },
            ],
          },
        ],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      res.status(anthropicRes.status).json({ error: `Anthropic API error: ${errText}` });
      return;
    }

    const data = await anthropicRes.json();
    const textBlock = (data.content || []).find((b) => b.type === "text");
    if (!textBlock) {
      res.status(502).json({ error: "No text response from model" });
      return;
    }

    const clean = textBlock.text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    res.status(200).json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message || "Unknown error" });
  }
}
