// app/splashscreen.tsx
import { useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  StyleSheet,
  Text
} from "react-native";

export default function SplashScreen() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(1)).current; // 1 = fully visible

  useEffect(() => {
    // Step 1: Hold splash for 2s
    const timer = setTimeout(() => {
      // Step 2: Fade out animation
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 800, // fade duration
        useNativeDriver: true,
      }).start(() => {
        // Step 3: Navigate after fade completes
        router.replace("/");
      });
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Image
        source={require("../assets/images/Vector.png")}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.title}>RiseFund</Text>
      <ActivityIndicator size="large" color="#fff" style={{ marginTop: 20 }} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#00D09E",
  },
  logo: { width: 100, height: 100 },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    marginTop: 20,
  },
});
