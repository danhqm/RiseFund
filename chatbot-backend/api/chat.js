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

    // FIX 1: Use chat.completions.create
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // FIX 2: Use a standard model name like gpt-4o-mini or gpt-3.5-turbo
      messages: [
        // FIX 3: Change 'input' to 'messages'
        {
          role: "system",
          content:
            "Your name is Fin, a helpful financial mentor. Keep responses short, clear, and practical. Use MYR (RM) where relevant.",
        },
        ...chatHistory.map((m) => ({ role: m.role, content: m.content })),
      ],
    });

    // FIX 4: Correctly parse the standard OpenAI response object
    const botReply =
      response.choices[0]?.message?.content ||
      "Sorry — I couldn’t generate a reply.";

    // Add bot reply to history so it remembers the conversation
    chatHistory.push({ role: "assistant", content: botReply });

    res.status(200).json({ success: true, text: botReply });
  } catch (err) {
    console.error("Chat handler error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}
