import { supabase } from "@/utils/supabase";
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

    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id;

    if (!userId) {
      setError("You need to be logged in to scan receipts.");
      return;
    }

    try {
      const res = await fetch(OCR_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64,
          userId,
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

        <Text style={styles.headerTitle}>Receipt{"\n"}Scanner</Text>

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
          <TouchableOpacity style={styles.scanButton} onPress={pickImage}>
            <Ionicons name="scan-outline" size={20} color="#093030" />
            <Text style={styles.scanButtonText}>
              {loading ? "Scanning..." : "Scan Receipt"}
            </Text>
          </TouchableOpacity>

          {error && <Text style={styles.errorText}>{error}</Text>}

          {receiptData && (
            <View style={styles.resultCard}>
              <Text style={styles.resultTitle}>Last Scanned Receipt</Text>

              <Text style={styles.resultLabel}>Merchant</Text>
              <Text style={styles.resultValue}>
                {receiptData.merchant_name || "Unknown"}
              </Text>

              <Text style={styles.resultLabel}>Date</Text>
              <Text style={styles.resultValue}>
                {receiptData.receipt_date || "—"}
              </Text>

              <Text style={styles.resultLabel}>Total Amount</Text>
              <Text style={styles.resultValue}>
                RM {Number(receiptData.total_amount || 0).toFixed(2)}
              </Text>

              {Array.isArray(receiptData.items) &&
                receiptData.items.length > 0 && (
                  <>
                    <Text style={[styles.resultLabel, { marginTop: 10 }]}>
                      Items
                    </Text>
                    {receiptData.items
                      .slice(0, 3)
                      .map((item: any, idx: number) => (
                        <Text key={idx} style={styles.itemText}>
                          • {item.name} – RM{" "}
                          {Number(item.price || 0).toFixed(2)}
                        </Text>
                      ))}

                    {receiptData.items.length > 3 && (
                      <Text style={styles.moreItemsText}>
                        +{receiptData.items.length - 3} more item(s)
                      </Text>
                    )}
                  </>
                )}
            </View>
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
  resultCard: {
    marginTop: 24,
    width: "100%",
    backgroundColor: "#E9FFF4",
    borderRadius: 16,
    padding: 14,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#093030",
    marginBottom: 8,
  },
  resultLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4A5B5B",
    marginTop: 4,
  },
  resultValue: {
    fontSize: 13,
    color: "#093030",
  },
  itemText: {
    fontSize: 12,
    color: "#093030",
  },
  moreItemsText: {
    fontSize: 12,
    color: "#4A5B5B",
    marginTop: 4,
    fontStyle: "italic",
  },
  errorText: {
    marginTop: 10,
    fontSize: 12,
    color: "#D9534F",
    textAlign: "center",
  },
});
