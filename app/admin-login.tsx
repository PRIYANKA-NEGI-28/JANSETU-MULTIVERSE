import { View, Text, Pressable, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Shield, Lock, ArrowLeft, Eye, EyeOff } from 'lucide-react-native';
import { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLang } from '../lib/langContext';

const ADMIN_PASSWORD = 'jansetu2024';

export default function AdminLoginScreen() {
  const { T } = useLang();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [attempts, setAttempts] = useState(0);

  async function handleLogin() {
    if (!password.trim()) {
      setError(T.admin_login_incorrect);
      return;
    }

    setVerifying(true);
    setError('');

    await new Promise(r => setTimeout(r, 500));

    if (password === ADMIN_PASSWORD) {
      await AsyncStorage.setItem('jansetu_admin_auth', 'true');
      router.replace('/admin');
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      if (newAttempts >= 5) {
        setError(T.admin_login_attempts);
      } else {
        setError(T.admin_login_incorrect);
      }
    }
    setVerifying(false);
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-900">
      <View className="flex-1 p-6 items-center justify-center">
        {/* Back button */}
        <Pressable
          onPress={() => router.back()}
          className="absolute top-4 left-4 flex-row items-center gap-1"
        >
          <ArrowLeft size={20} color="#9ca3af" />
          <Text className="text-gray-400 text-sm">{T.admin_login_back}</Text>
        </Pressable>

        <View className="w-20 h-20 rounded-3xl bg-gradient-to-br from-orange-500 to-orange-600 items-center justify-center mb-6">
          <Shield size={40} color="white" />
        </View>

        <Text className="text-2xl font-bold text-white mb-2">{T.admin_login_title}</Text>
        <Text className="text-gray-400 text-sm mb-8">{T.admin_login_subtitle}</Text>

        <View className="w-full max-w-sm">
          <Text className="text-sm font-semibold text-gray-300 mb-2">{T.admin_login_password}</Text>
          <View className="relative">
            <View className="flex-row items-center bg-gray-800 border border-gray-700 rounded-xl">
              <View className="pl-4">
                <Lock size={18} color="#6b7280" />
              </View>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder={T.admin_login_placeholder}
                secureTextEntry={!showPassword}
                className="flex-1 px-3 py-4 text-white text-sm"
                placeholderTextColor="#6b7280"
                onSubmitEditing={handleLogin}
              />
              <Pressable onPress={() => setShowPassword(!showPassword)} className="px-4">
                {showPassword ? (
                  <EyeOff size={18} color="#6b7280" />
                ) : (
                  <Eye size={18} color="#6b7280" />
                )}
              </Pressable>
            </View>
          </View>

          {error ? (
            <Text className="text-red-400 text-sm mt-2">{error}</Text>
          ) : null}

          <Pressable
            onPress={handleLogin}
            disabled={verifying || attempts >= 5}
            className={`flex-row items-center justify-center gap-2 px-6 py-4 rounded-xl mt-4 ${verifying || attempts >= 5 ? 'bg-gray-700' : 'bg-orange-500'}`}
          >
            {verifying ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text className="text-white font-bold">{T.admin_login_enter}</Text>
            )}
          </Pressable>
        </View>

        <View className="absolute bottom-8">
          <Text className="text-xs text-gray-600 text-center">{T.admin_login_unauthorized}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
