import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { getDataLayer } from '@/db';
import { useSession } from '@/state/session';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

export default function AccountScreen() {
  const router = useRouter();
  const theme = useTheme();
  const bumpAccount = useSession((s) => s.bumpAccount);

  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = baseUrl.trim() && username.trim() && password.trim() && !saving;

  const onSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const data = await getDataLayer();
      await data.accounts.save({
        name: name.trim() || username.trim(),
        baseUrl: baseUrl.trim(),
        username: username.trim(),
        password: password.trim(),
        active: true,
      });
      bumpAccount();
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  const field = (
    label: string,
    value: string,
    onChange: (t: string) => void,
    opts: { placeholder?: string; secure?: boolean; keyboard?: 'url' | 'default' } = {},
  ) => (
    <View style={styles.field}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={opts.placeholder}
        placeholderTextColor={theme.textSecondary}
        secureTextEntry={opts.secure}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={opts.keyboard === 'url' ? 'url' : 'default'}
        style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
      />
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ThemedText type="small" themeColor="textSecondary" style={styles.intro}>
          Enter your Xtream Codes login. Your credentials are stored only on this
          device and never leave it except to talk to your provider.
        </ThemedText>

        {field('Display name (optional)', name, setName, { placeholder: 'My Provider' })}
        {field('Server URL', baseUrl, setBaseUrl, {
          placeholder: 'http://example.com:8080',
          keyboard: 'url',
        })}
        {field('Username', username, setUsername, { placeholder: 'username' })}
        {field('Password', password, setPassword, { placeholder: 'password', secure: true })}

        {error ? (
          <ThemedText type="small" style={[styles.error, { color: '#ff5a5a' }]}>
            {error}
          </ThemedText>
        ) : null}

        <Pressable
          onPress={onSave}
          disabled={!canSave}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: canSave ? '#3c87f7' : theme.backgroundSelected },
            pressed && styles.pressed,
          ]}>
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText type="smallBold" themeColor="text" style={styles.buttonText}>
              Save & activate
            </ThemedText>
          )}
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.three },
  intro: { lineHeight: 20 },
  field: { gap: Spacing.one },
  input: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  error: { marginTop: Spacing.one },
  button: {
    marginTop: Spacing.two,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  buttonText: { color: '#ffffff' },
  pressed: { opacity: 0.8 },
});
