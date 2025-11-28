import OpenAI from "openai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ text: "Method not allowed" });
  }

  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ text: "No message provided." });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      temperature: 0.8,
      messages: [
        {
          role: "system",
          content: `
            You are "Fin", an empathetic and knowledgeable financial mentor
            for young adults in Malaysia. Help them save, budget, reduce debt,
            and make confident money decisions. Be friendly and simple.
          `,
        },
        { role: "user", content: message },
      ],
    });

    const botReply = response.choices[0].message.content;
    res.status(200).json({ text: botReply });
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ text: "Server error. Please try again later." });
  }
}
