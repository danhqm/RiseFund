import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../utils/supabase";

export default function Login() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert("Error", "Please fill all fields");
      return;
    }

    // 1️⃣ Find email using username
    const { data: userProfile, error: profileError } = await supabase
      .from("users")
      .select("email")
      .eq("username", username)
      .single();

    if (profileError || !userProfile) {
      Alert.alert("Login Failed", "Username not found");
      return;
    }

    // 2️⃣ Login using email
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: userProfile.email,
      password,
    });

    if (authError) {
      if (authError.message.includes("Email not confirmed")) {
        Alert.alert(
          "Email not verified",
          "Please check your email and confirm your account before logging in."
        );
      } else {
        Alert.alert("Login Failed", authError.message);
      }
      return;
    }

    // ✅ Success
    router.replace("/(tabs)");
  };

  const handleResendVerification = async () => {
    if (!username) {
      Alert.alert("Error", "Please enter your username first");
      return;
    }

    const { data: userProfile } = await supabase
      .from("users")
      .select("email")
      .eq("username", username)
      .single();

    if (!userProfile) {
      Alert.alert("Error", "Username not found");
      return;
    }

    await supabase.auth.resend({
      type: "signup",
      email: userProfile.email,
    });

    Alert.alert(
      "Verification sent",
      "Please check your email to confirm your account."
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <Text style={styles.header}>Welcome</Text>

      {/* Card */}
      <View style={styles.card}>
        {/* Username / Email */}
        <Text style={styles.label}>Username</Text>
        <TextInput
          placeholder="Username"
          placeholderTextColor="#9DBDB0"
          style={styles.input}
          value={username}
          onChangeText={setUsername}
        />

        {/* Password */}
        <Text style={styles.label}>Password</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            placeholder="••••••••"
            placeholderTextColor="#9DBDB0"
            secureTextEntry
            style={styles.passwordInput}
            value={password}
            onChangeText={setPassword}
          />
        </View>

        {/* Login Button */}
        <TouchableOpacity style={styles.loginButton } onPress={handleLogin}>
          <Text style={styles.loginText}>Log In</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleResendVerification}>
          <Text style={styles.resendText}>Resend verification email</Text>
        </TouchableOpacity>

        {/* Footer */}
        <Text style={styles.footer}>
          Don’t have an account?{" "}
          <Text style={styles.footerLink } onPress={() => router.push("/register")}>Sign Up</Text>
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#00D09E",
    alignItems: "center",
  },

  header: {
    marginTop: 60,
    fontSize: 28,
    fontFamily: "Poppins_700Bold",
    color: "#0E3E3E",
  },

  card: {
    marginTop: 80,
    width: "100%",
    height: 670,
    backgroundColor: "#F1FFF3",
    borderTopLeftRadius: 60,
    borderTopRightRadius: 60,
    paddingHorizontal: 30,
    paddingTop: 40,
    alignItems: "center",
  },

  label: {
    alignSelf: "flex-start",
    fontSize: 14,
    color: "#0E3E3E",
    fontFamily: "Poppins_400Regular",
    marginTop: 15,
  },

  input: {
    borderColor: "#0E3E3E",
    width: "100%",
    backgroundColor: "#DFF7E2",
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    fontFamily: "Poppins_400Regular",
    marginTop: 6,
  },

  passwordContainer: {
    width: "100%",
    flexDirection: "row",
    borderColor: "#0E3E3E",
    alignItems: "center",
    backgroundColor: "#DFF7E2",
    borderRadius: 20,
    paddingHorizontal: 20,
    marginTop: 6,
  },

  passwordInput: {
    flex: 1,
    paddingVertical: 12,
    fontFamily: "Poppins_400Regular",
    borderColor: "#0E3E3E",
  },

  loginButton: {
    width: "80%",
    backgroundColor: "#00D09E",
    paddingVertical: 14,
    borderRadius: 25,
    alignItems: "center",
    marginTop: 30,
  },

  loginText: {
    color: "#0E3E3E",
    fontFamily: "Poppins_700Bold",
    fontSize: 16,
  },

  forgot: {
    marginTop: 15,
    color: "#0E3E3E",
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
  },

  footer: {
    marginTop: 30,
    fontSize: 12,
    color: "#7FA89A",
    fontFamily: "Poppins_400Regular",
  },

  footerLink: {
    color: "#00D09E",
    fontFamily: "Poppins_700Bold",
  },
  
  resendText: {
    marginTop: 16,
    color: "#00D09E",
    textAlign: "center",
    fontFamily: "Poppins_500Medium",
  },

});

