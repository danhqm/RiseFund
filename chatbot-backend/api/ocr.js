export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    // Read data from the request body (you can send imageBase64 and userId)
    const { imageBase64, userId } = req.body;

    // For testing, just return dummy JSON
    const dummyReceipt = {
      merchant_name: "Example Store",
      total_amount: 123.45,
      receipt_date: "2025-11-29",
      items: [
        { name: "Item 1", price: 50 },
        { name: "Item 2", price: 73.45 }
      ],
      imageUrl: "https://via.placeholder.com/150"
    };

    return res.status(200).json({ success: true, data: dummyReceipt });
  } catch (error) {
    console.error("OCR handler error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
