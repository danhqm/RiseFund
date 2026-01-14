import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const OCR_API_URL = "https://rise-fund-6r5s.vercel.app/api/ocr";

export default function ReceiptScanner() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const dummyUserId = "11111111-1111-1111-1111-111111111111";

  const pickImage = async () => {
    setError(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.5,
    });

    if (!result.canceled && result.assets[0].base64) {
      setImageUri(result.assets[0].uri);
      await scanReceipt(result.assets[0].base64);
    }
  };

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
      {/* Header (same style as EduFinance) */}
      <View style={styles.header}>
        <TouchableOpacity>
          <Ionicons name="chevron-back" size={24} color="#ffffff" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>
          Receipt{"\n"}Scanner
        </Text>

        <TouchableOpacity>
          <Ionicons name="notifications-outline" size={22} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* White rounded page (same height/feel as EduFinance) */}
      <View style={styles.innerContainer}>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>
            Upload A Receipt To Automatically{"\n"}Track Your Spending
          </Text>

          {/* Dummy / preview receipt image */}
          <View style={styles.receiptPreview}>
            <Image
              source={require("../../assets/images/receipt-check.png")}
              style={styles.receiptImage}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.helperText}>Clear image works the best.</Text>

          {/* Scan button (logic same as before; hook pickImage if/when you want) */}
          <TouchableOpacity
            style={styles.scanButton}
            // onPress={pickImage} // <- uncomment when you’re ready to hook it up
          >
            <Ionicons name="scan-outline" size={20} color="#093030" />
            <Text style={styles.scanButtonText}>
              {loading ? "Scanning..." : "Scan Receipt"}
            </Text>
          </TouchableOpacity>

          {error && (
            <Text style={styles.errorText}>
              {error}
            </Text>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const PRIMARY = "#00D09E";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PRIMARY,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    color: "#ffffff",
    lineHeight: 22,
  },

  // Same idea as EduFinance: rounded white area filling the rest
  innerContainer: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingHorizontal: 24,
    paddingTop: 32,
    alignItems: "center",
  },

  cardContent: {
    width: "100%",
    alignItems: "center",
  },

  cardTitle: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    color: "#093030",
    marginBottom: 40,
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
    backgroundColor: PRIMARY,
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

  errorText: {
    marginTop: 12,
    fontSize: 12,
    color: "red",
    textAlign: "center",
  },
});
