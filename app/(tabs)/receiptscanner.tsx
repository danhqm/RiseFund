import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import { ActivityIndicator, Button, Image, ScrollView, StyleSheet, Text, View } from "react-native";

const OCR_API_URL = "https://rise-fund-6r5s.vercel.app/api/ocr";

export default function ReceiptScanner() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // For now, use dummy user ID; replace with logged-in user ID later
  const dummyUserId = "11111111-1111-1111-1111-111111111111";

  // Pick an image from the library
  const pickImage = async () => {
    setError(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.5, // smaller size to avoid serverless limits
    });

    if (!result.canceled && result.assets[0].base64) {
      setImageUri(result.assets[0].uri);
      await scanReceipt(result.assets[0].base64);
    }
  };

  // Send image to OCR API
  const scanReceipt = async (base64: string) => {
    setLoading(true);
    setReceiptData(null);
    setError(null);

    try {
      const res = await fetch(OCR_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64,
          userId: dummyUserId,
        }),
      });

      // Parse response safely
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        console.error("Response is not valid JSON:", text);
        setError("Invalid response from server");
        return;
      }

      if (!data.success) {
        console.error("OCR fetch failed:", data.error);
        setError(data.error || "OCR failed");
        return;
      }

      setReceiptData(data.data);
    } catch (err: unknown) {
      console.error("Fetch error:", err);
      if (err instanceof Error) setError(err.message);
      else setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Button title="Pick Receipt Image" onPress={pickImage} />

      {loading && <ActivityIndicator size="large" color="#0000ff" style={{ marginTop: 20 }} />}

      {imageUri && (
        <Image source={{ uri: imageUri }} style={{ width: 200, height: 200, marginTop: 20 }} />
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      {receiptData && (
        <View style={{ marginTop: 20 }}>
          <Text style={styles.heading}>Receipt Details:</Text>
          <Text>Merchant: {receiptData.merchant_name}</Text>
          <Text>Total: {receiptData.total_amount}</Text>
          <Text>Date: {receiptData.receipt_date}</Text>
          <Text>Items:</Text>
          {receiptData.items.map((item: any, index: number) => (
            <Text key={index}>
              {item.name} - {item.price}
            </Text>
          ))}
          {receiptData.image_url && (
            <Image
              source={{ uri: receiptData.image_url }}
              style={{ width: 200, height: 200, marginTop: 10 }}
            />
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 100,
  },
  heading: {
    fontWeight: "bold",
    marginBottom: 10,
  },
  error: {
    color: "red",
    marginTop: 20,
  },
});
