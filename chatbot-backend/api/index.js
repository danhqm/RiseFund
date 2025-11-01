import bodyParser from "body-parser";
import cors from "cors";
import express from "express";
import OpenAI from "openai";

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.get("/", (req, res) => {
  res.send("🤖 Financial Mentor backend is running!");
});

// ✅ Keep short-term memory (5 latest messages)
const MAX_HISTORY = 5;

// store chat history in memory (simple for demo, you can later tie it to user ID)
let chatHistory = [];

app.post("/chat", async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ text: "No message provided." });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // add user message to history
  chatHistory.push({ role: "user", content: message });

  // keep only recent messages
  if (chatHistory.length > MAX_HISTORY * 2) {
    chatHistory = chatHistory.slice(-MAX_HISTORY * 2);
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      temperature: 0.8, // 🎛 controls creativity
      messages: [
        {
          role: "system",
          content: `
            You are "Fin", an empathetic and knowledgeable financial mentor for young adults in Malaysia.
            Your goal is to help users make smarter financial decisions, manage debt, save money,
            and build confidence in handling their finances.

            Speak in a friendly, encouraging tone with short and clear advice.
            Avoid jargon unless you explain it simply.
          `,
        },
        ...chatHistory, // 👈 include short-term memory
      ],
    });

    const botReply = response.choices[0].message.content;

    // add assistant reply to memory
    chatHistory.push({ role: "assistant", content: botReply });

    res.json({ text: botReply });
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ text: "Server error. Please try again later." });
  }
});

export default app;
