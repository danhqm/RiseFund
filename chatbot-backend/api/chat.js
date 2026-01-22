// api/chat.js
import OpenAI from "openai";

let chatHistory = [];
const MAX_HISTORY = 5;

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "No message provided" });

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    chatHistory.push({ role: "user", content: message });
    if (chatHistory.length > MAX_HISTORY * 2)
      chatHistory = chatHistory.slice(-MAX_HISTORY * 2);

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content:
            "Your name is Fin, a helpful financial mentor. Keep responses short, clear, and practical. Use MYR (RM) where relevant.",
        },
        ...chatHistory.map((m) => ({ role: m.role, content: m.content })),
      ],
    });

    const first = response.output?.[0]?.content?.[0];
    const botReply =
      (first && "text" in first && first.text) ||
      "Sorry — I couldn’t generate a reply.";

    res.status(200).json({ success: true, text: botReply });
  } catch (err) {
    console.error("Chat handler error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}
