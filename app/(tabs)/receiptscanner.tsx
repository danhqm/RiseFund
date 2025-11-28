import { Buffer } from "buffer";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import { ActivityIndicator, Button, Image, ScrollView, StyleSheet, Text, View } from "react-native";
global.Buffer = Buffer;



const OCR_API_URL = "https://rise-fund.vercel.app/api/ocr";

const ReceiptScanner = () => {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<any>(null);

  // -----------------------------
  // 1️⃣ Pick image from gallery
  // -----------------------------
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
      setOcrResult(null); // reset previous results
    }
  };

  // -----------------------------
  // 2️⃣ Convert image URI to base64 safely
  // -----------------------------
  const getBase64 = async (uri: string) => {
  // Fetch the image from the URI
  const response = await fetch(uri);
  const arrayBuffer = await response.arrayBuffer();

  // Convert to base64
  return Buffer.from(arrayBuffer).toString("base64");
};

  // -----------------------------
  // 3️⃣ Upload to OCR API
  // -----------------------------
  const scanReceipt = async () => {
    if (!imageUri || loading) return;

    setLoading(true);

    try {
      const base64 = await getBase64(imageUri);

      // Dummy userId for now
      const dummyUserId = "00000000-0000-0000-0000-000000000000";

      const res = await fetch(OCR_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, userId: dummyUserId }),
      });

      const data = await res.json();

      if (data.success) {
        setOcrResult(data.data);
      } else {
        console.error("OCR failed:", data.error);
        alert("OCR failed. Check console.");
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("Error scanning receipt");
    }

    setLoading(false);
  };

  // -----------------------------
  // 4️⃣ UI
  // -----------------------------
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Receipt Scanner</Text>

      <Button title="Pick Receipt Image" onPress={pickImage} />

      {imageUri && (
        <Image
          source={{ uri: imageUri }}
          style={styles.image}
        />
      )}

      {imageUri && !loading && (
        <Button title="Scan Receipt" onPress={scanReceipt} />
      )}

      {loading && <ActivityIndicator size="large" style={{ marginTop: 20 }} />}

      {ocrResult && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultTitle}>Extracted Receipt Data:</Text>

          <Text>Merchant: {ocrResult.merchant_name}</Text>
          <Text>Total: RM{ocrResult.total_amount}</Text>
          <Text>Date: {ocrResult.receipt_date}</Text>

          <Text style={{ marginTop: 10, fontWeight: "bold" }}>Items:</Text>
          {ocrResult.items.map((item: any, index: number) => (
            <Text key={index}>
              - {item.name}: RM{item.price}
            </Text>
          ))}

          {ocrResult.imageUrl && (
            <>
              <Text style={{ marginTop: 10, fontWeight: "bold" }}>Uploaded Image:</Text>
              <Image source={{ uri: ocrResult.imageUrl }} style={styles.uploadedImage} />
            </>
          )}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 20,
    marginTop: 50,
  },
  image: {
    width: "100%",
    height: 300,
    resizeMode: "contain",
    marginVertical: 20,
  },
  resultContainer: {
    marginTop: 30,
    width: "100%",
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  uploadedImage: {
    width: "100%",
    height: 250,
    resizeMode: "contain",
    marginTop: 10,
  },
});

export default ReceiptScanner;
