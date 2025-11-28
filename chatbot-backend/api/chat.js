// api/chat.js
import OpenAI from "openai";

let chatHistory = [];
const MAX_HISTORY = 5;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "No message provided" });

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    chatHistory.push({ role: "user", content: message });
    if (chatHistory.length > MAX_HISTORY * 2) chatHistory = chatHistory.slice(-MAX_HISTORY * 2);

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      temperature: 0.8,
      messages: [
        { role: "system", content: "You are a friendly financial mentor." },
        ...chatHistory,
      ],
    });

    const botReply = response.choices[0].message.content;
    chatHistory.push({ role: "assistant", content: botReply });

    res.status(200).json({ success: true, text: botReply });
  } catch (err) {
    console.error("Chat handler error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}
