import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';


export default function Chatbot() {
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    console.log("📡 Sending to:", process.env.EXPO_PUBLIC_API_URL);
    if (!input.trim()) return;

    const userMessage = { role: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch(process.env.EXPO_PUBLIC_API_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input }),
      });

      const data = await response.json();

      const botMessage = { role: 'assistant', text: data.text };
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Error:', error);
      const errorMessage = { role: 'assistant', text: '⚠️ Server not reachable.' };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Fin title */}
      <View style={styles.header}>
        <Text style={styles.headerText}>Fin</Text>
      </View>

      {/* Card */}
      <KeyboardAvoidingView
        style={styles.cardContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 80}
      >
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.cardHeader}>
            <Image
              source={require("../../assets/images/Fin.png")}
              style={styles.icon}
            />
            <View>
              <Text style={styles.cardTitle}>Seek advice From Fin</Text>
              <Text style={styles.cardDescription}>
                You can always ask an opinion from Fin!
              </Text>
            </View>
          </View>

          {/* Chat messages */}
          <View style={styles.chatWrapper}>
            <ScrollView
              style={styles.chatContainer}
              contentContainerStyle={{ paddingBottom: 20 }}
              keyboardShouldPersistTaps="handled"
            >
              {messages.map((msg, i) => (
                <View
                  key={i}
                  style={[
                    styles.message,
                    msg.role === "user" ? styles.userMessage : styles.finMessage,
                  ]}
                >
                  <Text style={styles.messageText}>{msg.text}</Text>
                </View>
              ))}
              {loading && <Text style={styles.loadingText}>🤖 Thinking...</Text>}
            </ScrollView>

            {/* Input */}
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Type a message..."
                placeholderTextColor="#666"
                value={input}
                onChangeText={setInput}
                onSubmitEditing={sendMessage}
                returnKeyType="send"
              />
              <TouchableOpacity onPress={sendMessage} style={styles.sendButton}>
                <Ionicons name="send" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#00D09E",
  },
  header: {
    height: 120,
    justifyContent: "center",
    alignItems: "center",
  },
  headerText: {
    color: "#0E3E3E",
    fontSize: 28,
    fontWeight: "bold",
  },
  cardContainer: {
    flex: 1,
  },
  card: {
    top: 35,
    flex: 1,
    backgroundColor: "#fff",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: 20,
    marginTop: -40, // overlap the green header
    paddingBottom: 20,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  icon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#093030",
  },
  cardDescription: {
    fontSize: 14,
    color: "#093030",
    marginTop: 4,
  },
  chatWrapper: {
    flex: 1, // makes messages area grow and pushes input to bottom
  },
  chatContainer: {
    flex: 1,
  },
  message: {
    marginVertical: 6,
    borderRadius: 15,
    padding: 10,
    maxWidth: "80%",
  },
  userMessage: {
    alignSelf: "flex-end",
    backgroundColor: "#00D09E",
  },
  finMessage: {
    alignSelf: "flex-start",
    backgroundColor: "#DFF7E2",
  },
  messageText: {
    color: "#093030",
    fontSize: 14,
  },
  loadingText: {
    color: "#093030",
    fontStyle: "italic",
  },
  inputContainer: {
    flexDirection: "row",
    marginTop: 8,
    alignItems: "center",
  },
  input: {
    flex: 1,
    backgroundColor: "#eee",
    padding: 12,
    borderRadius: 20,
    fontSize: 14,
  },
  sendButton: {
    backgroundColor: "#00D09E",
    padding: 12,
    borderRadius: 25,
    marginLeft: 8,
  },
});

