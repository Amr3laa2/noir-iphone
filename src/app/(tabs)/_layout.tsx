import { NativeTabs } from 'expo-router/unstable-native-tabs';

export default function TabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="movies">
        <NativeTabs.Trigger.Icon sf={{ default: 'film', selected: 'film.fill' }} />
        <NativeTabs.Trigger.Label>Movies</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="series">
        <NativeTabs.Trigger.Icon sf={{ default: 'tv', selected: 'tv.fill' }} />
        <NativeTabs.Trigger.Label>Series</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="live">
        <NativeTabs.Trigger.Icon sf="dot.radiowaves.left.and.right" />
        <NativeTabs.Trigger.Label>Live</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="downloads">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'arrow.down.circle', selected: 'arrow.down.circle.fill' }}
        />
        <NativeTabs.Trigger.Label>Downloads</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
