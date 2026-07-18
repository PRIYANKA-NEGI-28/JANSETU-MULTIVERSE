import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { LangProvider } from '../lib/langContext';
import '../global.css';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <LangProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="login"
            options={{ presentation: 'modal', headerShown: false }}
          />
          <Stack.Screen
            name="admin-login"
            options={{ presentation: 'modal', headerShown: false }}
          />
        </Stack>
      </LangProvider>
    </GestureHandlerRootView>
  );
}
