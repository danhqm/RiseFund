// app/_layout.tsx
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import { Animated } from "react-native";
import SplashScreen from "./splashscreen"; // 👈 import directly

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);
  const fadeAnim = new Animated.Value(1); // for fade-out animation

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }).start(() => setShowSplash(false));
    }, 3000); // show splash for 2s

    return () => clearTimeout(timer);
  }, []);

  if (showSplash) {
    return (
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <SplashScreen />
      </Animated.View>
    );
  }

  // once splash is hidden, show main app stack
  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
      <StatusBar style="light" />
    </>
  );
}
