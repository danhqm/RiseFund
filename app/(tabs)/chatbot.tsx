import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { fetch as expoFetch } from 'expo/fetch';
import { useState } from 'react';
import { SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';

// Use your .env variable for the API base URL
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8081';

export default function Chatbot() {
  const [input, setInput] = useState('');

  const { messages, error, sendMessage } = useChat({
    transport: new DefaultChatTransport({
      fetch: expoFetch as unknown as typeof globalThis.fetch,
      api: `${API_BASE_URL}/api/chat`, // dynamically uses your deployed URL
    }),
    onError: (error) => console.error('Chat Error:', error),
  });

  if (error) return <Text>{error.message}</Text>;

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View
        style={{
          flex: 1,
          flexDirection: 'column',
          paddingHorizontal: 8,
        }}
      >
        <ScrollView style={{ flex: 1 }}>
          {messages.map((m) => (
            <View key={m.id} style={{ marginVertical: 8 }}>
              <Text style={{ fontWeight: '700', marginBottom: 4 }}>
                {m.role === 'user' ? 'You' : 'Bot'}
              </Text>
              {m.parts.map((part, i) => {
                if (part.type === 'text') {
                  return <Text key={`${m.id}-${i}`}>{part.text}</Text>;
                }
                return null;
              })}
            </View>
          ))}
        </ScrollView>

        <View style={{ marginTop: 8 }}>
          <TextInput
            style={{
              backgroundColor: '#f2f2f2',
              padding: 8,
              borderRadius: 8,
            }}
            placeholder="Say something..."
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => {
              if (input.trim()) {
                sendMessage({ text: input });
                setInput('');
              }
            }}
            autoFocus
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
