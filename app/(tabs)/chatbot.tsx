import React, { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      <View style={{ flex: 1, padding: 12 }}>
        <ScrollView style={{ flex: 1 }}>
          {messages.map((msg, i) => (
            <View
              key={i}
              style={{
                marginVertical: 6,
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                backgroundColor: msg.role === 'user' ? '#DCF8C6' : '#FFF',
                borderRadius: 10,
                padding: 8,
                maxWidth: '80%',
              }}
            >
              <Text>{msg.text}</Text>
            </View>
          ))}
          {loading && <Text>🤖 Thinking...</Text>}
        </ScrollView>

        <TextInput
          style={{
            backgroundColor: 'white',
            padding: 12,
            borderRadius: 8,
            marginTop: 8,
          }}
          placeholder="Type a message..."
          value={input}
          onChangeText={setInput}
          onSubmitEditing={sendMessage}
          returnKeyType="send"
        />
      </View>
    </SafeAreaView>
  );
}
