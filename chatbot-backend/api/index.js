import bodyParser from "body-parser";
import cors from "cors";
import express from "express";
import OpenAI from "openai";

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.get("/", (req, res) => {
  res.send("🤖 Chatbot backend is running!");
});

app.post("/chat", async (req, res) => {
  const { message } = req.body;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: message }],
  });

  res.json({ text: response.choices[0].message.content });
});

// ✅ Use module.exports for Vercel’s Node runtime
export default app;
