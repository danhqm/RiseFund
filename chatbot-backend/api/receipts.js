import { supabase } from "../../utils/supabase";

export default async function handler(req, res) {
  if (req.method === "GET") {
    // Get all receipts for a user (optional: filter by user_id)
    const { userId } = req.query; // e.g., /api/receipts?userId=...
    const { data, error } = await supabase
      .from("receipts")
      .select("*")
      .eq("user_id", userId);

    if (error) return res.status(500).json({ success: false, error: error.message });
    return res.status(200).json({ success: true, data });
  }

  // Optionally handle POST if you want to add receipts directly
  if (req.method === "POST") {
    const { user_id, merchant_name, total_amount, receipt_date, items, image_url } = req.body;

    const { data, error } = await supabase.from("receipts").insert([
      { user_id, merchant_name, total_amount, receipt_date, items, image_url },
    ]);

    if (error) return res.status(500).json({ success: false, error: error.message });
    return res.status(200).json({ success: true, data });
  }

  return res.status(405).json({ success: false, error: "Method not allowed" });
}
