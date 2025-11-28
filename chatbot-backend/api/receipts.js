import { supabase } from "../utils/supabase.js";

export default async function handler(req, res) {
  if (req.method === "GET") {
    const { userId } = req.query;
    const { data, error } = await supabase
      .from("receipts")
      .select("*")
      .eq("user_id", userId);

    if (error) return res.status(500).json({ success: false, error: error.message });
    return res.status(200).json({ success: true, data });
  }

  if (req.method === "POST") {
    const { user_id, merchant_name, total_amount, receipt_date, items, image_url } = req.body;
    const { data, error } = await supabase
      .from("receipts")
      .insert([{ user_id, merchant_name, total_amount, receipt_date, items, image_url }])
      .select();

    if (error) return res.status(500).json({ success: false, error: error.message });
    return res.status(200).json({ success: true, data });
  }

  return res.status(405).json({ success: false, error: "Method not allowed" });
}
