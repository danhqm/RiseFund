import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// We will expand these later with subcategories and limits!
const LHDN_CATEGORIES = [
  { id: "GAYA_HIDUP", title: "Gaya Hidup (Lifestyle)", icon: "book-outline" },
  { id: "PERUBATAN", title: "Perubatan & Penjagaan", icon: "medkit-outline" },
  { id: "PENDIDIKAN", title: "Pendidikan & Asuhan", icon: "school-outline" },
  {
    id: "INSURANS",
    title: "Insurans & Pelaburan",
    icon: "shield-checkmark-outline",
  },
  { id: "INDIVIDU", title: "Individu & Tanggungan", icon: "person-outline" },
  { id: "LAIN_LAIN", title: "Perbelanjaan Lain", icon: "receipt-outline" },
];

// NOTE: This "export default" is exactly what Expo was complaining about missing!
export default function LHDNClaimScreen() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>LHDN Tax Relief 2026</Text>
        <Text style={styles.subHeader}>
          Select a category to scan your receipt
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {LHDN_CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={styles.categoryCard}
            onPress={() => setSelectedCategory(cat.id)}
          >
            <View style={styles.iconContainer}>
              <Ionicons name={cat.icon as any} size={24} color="#093030" />
            </View>
            <Text style={styles.categoryText}>{cat.title}</Text>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7F8",
  },
  header: {
    padding: 20,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#093030",
  },
  subHeader: {
    fontSize: 14,
    color: "#666",
    marginTop: 5,
  },
  scrollContent: {
    padding: 15,
  },
  categoryCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E8F0F0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  categoryText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
  },
});
