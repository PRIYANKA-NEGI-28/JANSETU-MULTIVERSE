import { View, Text, Pressable, TextInput, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, User, Mail, Lock, Phone } from 'lucide-react-native';
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useLang } from '../lib/langContext';

export default function LoginScreen() {
  const { T } = useLang();
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    password: '',
  });

  async function handleSubmit() {
    setError('');

    if (isRegister) {
      if (!form.fullName.trim()) {
        setError(T.auth_error_name);
        return;
      }
      if (!form.phone.trim() || form.phone.length !== 10) {
        setError(T.auth_error_phone_invalid);
        return;
      }
      if (!form.password || form.password.length < 6) {
        setError(T.auth_error_password);
        return;
      }

      setLoading(true);
      const { error: signUpError } = await supabase.auth.signUp({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        options: {
          data: {
            full_name: form.fullName.trim(),
            phone: form.phone.trim(),
          },
        },
      });
      setLoading(false);

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          setError(T.auth_error_registered);
        } else {
          setError(signUpError.message);
        }
      } else {
        router.back();
      }
    } else {
      if (!form.email.trim() || !form.password) {
        setError(T.auth_error_credentials);
        return;
      }

      setLoading(true);
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });
      setLoading(false);

      if (signInError) {
        setError(T.auth_error_credentials);
      } else {
        router.back();
      }
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="flex-1 p-6">
        {/* Back */}
        <Pressable
          onPress={() => router.back()}
          className="flex-row items-center gap-1 mb-6"
        >
          <ArrowLeft size={20} color="#6b7280" />
          <Text className="text-gray-500 text-sm">{T.auth_back_home}</Text>
        </Pressable>

        {/* Logo */}
        <View className="items-center mb-8">
          <View className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 items-center justify-center mb-4">
            <Text className="text-white font-black text-xl">JS</Text>
          </View>
          <Text className="text-xl font-bold text-gray-900 mb-1">
            {isRegister ? T.auth_register : T.auth_login}
          </Text>
          <Text className="text-gray-500 text-sm">{T.auth_subtitle}</Text>
        </View>

        {/* Tab Switcher */}
        <View className="flex-row bg-gray-100 rounded-xl p-1 mb-6">
          <Pressable
            onPress={() => setIsRegister(false)}
            className={`flex-1 py-2 rounded-lg ${!isRegister ? 'bg-white shadow-sm' : ''}`}
          >
            <Text className={`text-sm font-semibold text-center ${!isRegister ? 'text-gray-900' : 'text-gray-500'}`}>
              {T.auth_login}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setIsRegister(true)}
            className={`flex-1 py-2 rounded-lg ${isRegister ? 'bg-white shadow-sm' : ''}`}
          >
            <Text className={`text-sm font-semibold text-center ${isRegister ? 'text-gray-900' : 'text-gray-500'}`}>
              {T.auth_register}
            </Text>
          </Pressable>
        </View>

        {/* Form */}
        <View className="gap-4">
          {isRegister && (
            <View>
              <Text className="text-sm font-semibold text-gray-700 mb-1">{T.auth_full_name}</Text>
              <View className="flex-row items-center bg-white border border-gray-200 rounded-xl px-4">
                <User size={18} color="#9ca3af" />
                <TextInput
                  value={form.fullName}
                  onChangeText={v => setForm(f => ({ ...f, fullName: v }))}
                  placeholder={T.auth_full_name}
                  className="flex-1 py-3 px-3 text-sm"
                  placeholderTextColor="#9ca3af"
                />
              </View>
            </View>
          )}

          {isRegister && (
            <View>
              <Text className="text-sm font-semibold text-gray-700 mb-1">{T.auth_mobile}</Text>
              <View className="flex-row items-center bg-white border border-gray-200 rounded-xl px-4">
                <Phone size={18} color="#9ca3af" />
                <TextInput
                  value={form.phone}
                  onChangeText={v => setForm(f => ({ ...f, phone: v.replace(/[^0-9]/g, '') }))}
                  placeholder={T.auth_mobile_placeholder}
                  keyboardType="phone-pad"
                  maxLength={10}
                  className="flex-1 py-3 px-3 text-sm"
                  placeholderTextColor="#9ca3af"
                />
              </View>
              <Text className="text-xs text-gray-400 mt-1">{T.auth_mobile_hint}</Text>
            </View>
          )}

          <View>
            <Text className="text-sm font-semibold text-gray-700 mb-1">{T.auth_email}</Text>
            <View className="flex-row items-center bg-white border border-gray-200 rounded-xl px-4">
              <Mail size={18} color="#9ca3af" />
              <TextInput
                value={form.email}
                onChangeText={v => setForm(f => ({ ...f, email: v }))}
                placeholder={T.auth_email_placeholder}
                keyboardType="email-address"
                autoCapitalize="none"
                className="flex-1 py-3 px-3 text-sm"
                placeholderTextColor="#9ca3af"
              />
            </View>
          </View>

          <View>
            <Text className="text-sm font-semibold text-gray-700 mb-1">{T.auth_password}</Text>
            <View className="flex-row items-center bg-white border border-gray-200 rounded-xl px-4">
              <Lock size={18} color="#9ca3af" />
              <TextInput
                value={form.password}
                onChangeText={v => setForm(f => ({ ...f, password: v }))}
                placeholder={T.auth_password_placeholder}
                secureTextEntry
                className="flex-1 py-3 px-3 text-sm"
                placeholderTextColor="#9ca3af"
              />
            </View>
          </View>

          {error ? (
            <View className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              <Text className="text-red-600 text-sm">{error}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={handleSubmit}
            disabled={loading}
            className={`flex-row items-center justify-center gap-2 py-4 rounded-xl ${loading ? 'bg-gray-300' : 'bg-orange-500'}`}
          >
            {loading ? (
              <ActivityIndicator size="small" color="white" />
            ) : null}
            <Text className="text-white font-bold">
              {loading
                ? (isRegister ? T.auth_creating : T.auth_signing_in)
                : (isRegister ? T.auth_create_account : T.auth_sign_in)}
            </Text>
          </Pressable>
        </View>

        <Text className="text-xs text-gray-400 text-center mt-6">{T.auth_secured}</Text>
      </View>
    </SafeAreaView>
  );
}
