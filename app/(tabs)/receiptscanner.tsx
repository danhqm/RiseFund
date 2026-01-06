import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity>
          <Ionicons name="arrow-back" size={24} color="#093030" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Receipt{"\n"}Scanner</Text>

        <TouchableOpacity>
          <Ionicons name="notifications-outline" size={22} color="#093030" />
        </TouchableOpacity>
      </View>

      {/* Main Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          Upload A Receipt To Automatically{"\n"}Track Your Spending
        </Text>

        {/* Dummy receipt image */}
        <View style={styles.receiptPreview}>
          <Image
            source={require("../../assets/images/receipt-check.png")} 
            style={styles.receiptImage}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.helperText}>Clear image works the best.</Text>

        {/* Scan Button */}
        <TouchableOpacity style={styles.scanButton}>
          <Ionicons name="scan-outline" size={20} color="#093030" />
          <Text style={styles.scanButtonText}>Scan Receipt</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#00D09E",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 25,
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    color: "#093030",
    lineHeight: 22,
  },

  card: {
    top: 35,
    flex: 1,
    backgroundColor: "#fff",
    marginTop: 50,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: 24,
    alignItems: "center",
  },

  cardTitle: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    color: "#093030",
    marginBottom: 70,
  },

  receiptPreview: {
    width: 120,
    height: 160,
    borderWidth: 1.5,
    borderColor: "#CDEEE1",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  receiptImage: {
    width: 80,
    height: 100,
  },

  helperText: {
    fontSize: 13,
    color: "#093030",
    marginBottom: 20,
  },

  scanButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#00D09E",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },

  scanButtonText: {
    color: "#093030",
    fontWeight: "700",
    fontSize: 14,
  },
});
