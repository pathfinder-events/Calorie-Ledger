// Vercel serverless function: POST { image: base64Jpeg } OR { description: string }
// -> food estimate JSON. Keeps the Gemini API key server-side. Set
// GEMINI_API_KEY in your Vercel project's environment variables.

const MODEL = "gemini-2.5-flash";

const JSON_SHAPE =
  '{"food_name": string (short, e.g. "Grilled chicken salad"), "items": string[] (list of components), "portion_note": string (brief portion size assessment), "estimated_calories": number, "confidence": "low"|"medium"|"high"}';

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const expectedSecret = process.env.APP_SHARED_SECRET;
  if (expectedSecret) {
    const provided = req.headers["x-app-secret"];
    if (provided !== expectedSecret) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }

  const { image, description } = req.body || {};
  if (!image && !description) {
    res.status(400).json({ error: "Missing image or description" });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Server missing GEMINI_API_KEY" });
    return;
  }

  const parts = image
    ? [
        {
          text: `You are a nutrition expert estimating calories from a food photo. Respond with JSON only, matching exactly this shape: ${JSON_SHAPE}. Make your best realistic estimate even if uncertain — never refuse.`,
        },
        { inline_data: { mime_type: "image/jpeg", data: image } },
      ]
    : [
        {
          text: `You are a nutrition expert estimating calories from a plain-text food description. The person wrote: "${description}". Respond with JSON only, matching exactly this shape: ${JSON_SHAPE}. Make your best realistic estimate given typical portions even if the description is vague — never refuse.`,
        },
      ];

  const callGemini = () =>
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseMimeType: "application/json",
        },
      }),
    });

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  try {
    let geminiRes = await callGemini();

    let attempt = 0;
    while (!geminiRes.ok && (geminiRes.status === 503 || geminiRes.status === 429) && attempt < 2) {
      attempt++;
      await sleep(attempt * 1000);
      geminiRes = await callGemini();
    }

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      res.status(geminiRes.status).json({ error: `Gemini API error: ${errText}` });
      return;
    }

    const data = await geminiRes.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      res.status(502).json({ error: "No text response from model" });
      return;
    }

    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    res.status(200).json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message || "Unknown error" });
  }
}