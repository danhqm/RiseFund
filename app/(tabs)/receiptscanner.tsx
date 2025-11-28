import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import { ActivityIndicator, Button, Image, ScrollView, Text, View } from "react-native";

const OCR_API_URL = "https://rise-fund-6r5s.vercel.app/api/ocr";

export default function ReceiptScanner() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const dummyUserId = "11111111-1111-1111-1111-111111111111"; // replace with actual user id

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0].base64) {
      setImageUri(result.assets[0].uri);
      scanReceipt(result.assets[0].base64);
    }
  };

  const scanReceipt = async (base64: string) => {
    try {
      setLoading(true);

      const res = await fetch(OCR_API_URL, {
        method: "POST", // must be POST
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, userId: dummyUserId }),
      });

      // Check HTTP status first
      if (!res.ok) {
        const text = await res.text(); // in case of HTML error page
        console.error("OCR fetch failed:", text);
        setLoading(false);
        return;
      }

      const data = await res.json(); // parse JSON

      if (!data.success) {
        console.error("OCR returned error:", data.error);
        setLoading(false);
        return;
      }

      setReceiptData(data.data);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 100 }}>
      <Button title="Pick Receipt Image" onPress={pickImage} />

      {loading && <ActivityIndicator size="large" color="#0000ff" />}

      {imageUri && <Image source={{ uri: imageUri }} style={{ width: 200, height: 200, marginTop: 20 }} />}

      {receiptData && (
        <View style={{ marginTop: 20 }}>
          <Text>Merchant: {receiptData.merchant_name}</Text>
          <Text>Total: {receiptData.total_amount}</Text>
          <Text>Date: {receiptData.receipt_date}</Text>
          <Text>Items:</Text>
          {receiptData.items.map((item: any, index: number) => (
            <Text key={index}>
              {item.name} - {item.price}
            </Text>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
