import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { ActivityIndicator } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../utils/supabase";

const MENU_ITEMS = [
  { label: "Edit Profile", icon: "person-outline" as const },
  { label: "Security", icon: "shield-checkmark-outline" as const },
  { label: "Setting", icon: "settings-outline" as const },
  { label: "Help", icon: "help-circle-outline" as const },
  { label: "Logout", icon: "log-out-outline" as const },
];

export default function ProfileScreen() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!user || userError) {
        setLoading(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("id, username, email, user_id")
        .eq("user_id", user.id)
        .single();  // you now expect exactly one row

      console.log("PROFILE:", profile, profileError);

      if (profile?.username) {
        setDisplayName(profile.username);
        setUserId(String(profile.id));
      }

      setLoading(false);
    };

    loadProfile();
  }, []);

  const nameToShow = displayName ?? "Guest";

  return (
    <SafeAreaView style={styles.container}>
      {/* Top green header */}
      <View style={styles.header}>
        <TouchableOpacity>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity>
          <Ionicons name="notifications-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          {/* Avatar */}
          <View style={styles.avatarWrapper}>
            <Image
              style={styles.avatar}
              source={{
                uri: "https://via.placeholder.com/150x150.png?text=Profile",
              }}
            />
          </View>

          {/* Name & ID */}
          {loading ? (
            <ActivityIndicator style={{ marginTop: 16 }} />
          ) : (
            <>
              <Text style={styles.name}>{nameToShow}</Text>
              {userId && (
                <Text style={styles.idText}>
                  <Text style={styles.idLabel}>ID: </Text>
                  <Text style={styles.idValue}>{userId}</Text>
                </Text>
              )}
            </>
          )}

          {/* Menu */}
          <View style={styles.menuList}>
            {MENU_ITEMS.map((item) => (
              <TouchableOpacity
                key={item.label}
                style={styles.menuRow}
                activeOpacity={0.7}
                onPress={() => {
                  if (item.label === "Edit Profile") {
                    router.push("/editprofile");  // 👈 go to edit screen
                  }
                  // you can handle others later (Security, Logout etc.)
                }}
              >
                <View style={styles.menuIconWrapper}>
                  <Ionicons name={item.icon} size={24} color="#2F80ED" />
                </View>
                <Text style={styles.menuLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const PRIMARY = "#05C88F";
const BG_LIGHT = "#E9FFF4";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PRIMARY,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 10,
    justifyContent: "space-between",
  },
  headerTitle: {
    color: "#0E3E3E",
    fontSize: 18,
    fontWeight: "700",
  },
  contentContainer: {
    flexGrow: 1,
  },
  card: {
    flex: 1,
    backgroundColor: "#fff",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    alignItems: "center",
    top: 80,
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  avatarWrapper: {
    position: "absolute",
    top: -45,
    alignSelf: "center",
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 4,
    borderColor: BG_LIGHT,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
  name: {
    marginTop: 10,
    fontSize: 20,
    fontWeight: "700",
    color: "#0E3E3E",
  },
  idText: {
    marginTop: 4,
    fontSize: 13,
  },
  idLabel: {
    color: "#8B9A9A",
    fontWeight: "600",
  },
  idValue: {
    color: "#05A66B",
    fontWeight: "700",
  },
  menuList: {
    marginTop: 32,
    alignSelf: "stretch",
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
  },
  menuIconWrapper: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#E4F0FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  menuLabel: {
    fontSize: 16,
    color: "#16302A",
    fontWeight: "500",
  },
});
