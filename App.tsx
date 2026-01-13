import React, { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Linking } from 'react-native';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from './src/screens/HomeScreen';
import { MovieDetailScreen } from './src/screens/MovieDetailScreen';
import { EpisodeScreen } from './src/screens/EpisodeScreen';
import { VideoPlayerScreen } from './src/screens/VideoPlayerScreen';
import { IndexerStatusScreen } from './src/screens/IndexerStatusScreen';
import { AddonsScreen } from './src/screens/AddonsScreen';
import { MagnetScreen } from './src/screens/MagnetScreen';
import { ComingSoonScreen } from './src/screens/ComingSoonScreen';
import { MusicHomeScreen } from './src/screens/MusicHomeScreen';
import { MusicPlayerScreen } from './src/screens/MusicPlayerScreen';
import { MusicAlbumScreen } from './src/screens/MusicAlbumScreen';
import { MusicArtistScreen } from './src/screens/MusicArtistScreen';
import { MusicPlaylistScreen } from './src/screens/MusicPlaylistScreen';
import { MusicLibraryScreen } from './src/screens/MusicLibraryScreen';
import { MusicSettingsScreen } from './src/screens/MusicSettingsScreen';
import { MyPlaylistsScreen } from './src/screens/MyPlaylistsScreen';
import { UserPlaylistScreen } from './src/screens/UserPlaylistScreen';
import { getState } from './src/services/musicPlayerService';

const Stack = createNativeStackNavigator();

export default function App() {
  const navigationRef = useRef<NavigationContainerRef<any>>(null);

  useEffect(() => {
    // Handle deep link when app is opened from notification
    const handleDeepLink = (event: { url: string }) => {
      if (event.url === 'trackplayer://notification.click') {
        // Navigate to music player if there's a song playing
        const playerState = getState();
        if (playerState.currentSong && navigationRef.current) {
          navigationRef.current.navigate('MusicPlayer');
        }
      }
    };

    // Get initial URL (when app was opened from notification while closed)
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });

    // Listen for deep links when app is already open
    const subscription = Linking.addEventListener('url', handleDeepLink);
    return () => subscription.remove();
  }, []);

  return (
    <NavigationContainer ref={navigationRef}>
      <StatusBar style="light" />
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="MovieDetail" component={MovieDetailScreen} options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="Episodes" component={EpisodeScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="VideoPlayer" component={VideoPlayerScreen} options={{ animation: 'fade', presentation: 'fullScreenModal' }} />
        <Stack.Screen name="IndexerStatus" component={IndexerStatusScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="Addons" component={AddonsScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="Magnet" component={MagnetScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="ComingSoon" component={ComingSoonScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="MusicHome" component={MusicHomeScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="MusicPlayer" component={MusicPlayerScreen} options={{ animation: 'slide_from_bottom', presentation: 'fullScreenModal' }} />
        <Stack.Screen name="MusicAlbum" component={MusicAlbumScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="MusicArtist" component={MusicArtistScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="MusicPlaylist" component={MusicPlaylistScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="MusicLibrary" component={MusicLibraryScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="MusicSettings" component={MusicSettingsScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="MyPlaylists" component={MyPlaylistsScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="UserPlaylist" component={UserPlaylistScreen} options={{ animation: 'slide_from_right' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
