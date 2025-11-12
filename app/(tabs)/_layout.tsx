// app/(tabs)/_layout.tsx
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#00D09E",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="edufinance"
        options={{
          title: "EduFinance",
          tabBarIcon: ({ color, size }) => <Ionicons name="book" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="chatbot"
        options={{
          title: "Chatbot",
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
