import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Dimensions,
    Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
    ChevronLeft,
    Play,
    Shuffle,
    ListMusic,
    Trash2,
    MoreVertical,
} from 'lucide-react-native';
import { Image } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';
import { MusicMiniPlayer } from '../components/MusicMiniPlayer';
import { StorageService, UserPlaylist, PlaylistTrack } from '../services/storage';
import {
    playQueue,
    getState,
    addPlaybackListener,
    PlaybackState,
} from '../services/musicPlayerService';
import { useMusicColors } from '../hooks/useMusicColors';

const { width } = Dimensions.get('window');

interface UserPlaylistScreenProps {
    navigation: any;
    route: any;
}

export const UserPlaylistScreen = ({ navigation, route }: UserPlaylistScreenProps) => {
    const initialPlaylist: UserPlaylist = route.params?.playlist;
    const insets = useSafeAreaInsets();
    const musicColors = useMusicColors();
    const [playlist, setPlaylist] = useState<UserPlaylist>(initialPlaylist);
    const [playerState, setPlayerState] = useState<PlaybackState>(getState());

    // Reload playlist when focused
    useFocusEffect(
        useCallback(() => {
            loadPlaylist();
            const unsubscribe = addPlaybackListener(setPlayerState);
            return unsubscribe;
        }, [initialPlaylist.id])
    );

    const loadPlaylist = async () => {
        const updated = await StorageService.getPlaylistById(initialPlaylist.id);
        if (updated) {
            setPlaylist(updated);
        }
    };

    // Convert PlaylistTrack to HiFiSong format for playback
    const convertToHiFiSong = (track: PlaylistTrack) => ({
        id: track.id,
        title: track.title,
        artist: track.artist,
        artistId: track.artistId,
        album: track.album,
        albumId: track.albumId,
        duration: track.duration,
        coverArt: track.coverArt || undefined,
        source: track.source,
        size: 0,
        suffix: 'flac',
        contentType: 'audio/flac',
    });

    // Play All - Sequential from first track
    const handlePlayAll = async () => {
        if (playlist.tracks.length === 0) {
            Alert.alert('Empty Playlist', 'Add some songs to play');
            return;
        }
        const songs = playlist.tracks.map(convertToHiFiSong);
        await playQueue(songs, 0);
    };

    // Shuffle - Random order playback
    const handleShuffle = async () => {
        if (playlist.tracks.length === 0) {
            Alert.alert('Empty Playlist', 'Add some songs to shuffle');
            return;
        }
        const shuffled = [...playlist.tracks].sort(() => Math.random() - 0.5);
        const songs = shuffled.map(convertToHiFiSong);
        await playQueue(songs, 0);
    };

    // Play single track (starts queue from that track)
    const handlePlayTrack = async (index: number) => {
        const songs = playlist.tracks.map(convertToHiFiSong);
        await playQueue(songs, index);
    };

    // Remove track from playlist
    const handleRemoveTrack = (track: PlaylistTrack, index: number) => {
        Alert.alert(
            'Remove Track',
            `Remove "${track.title}" from this playlist?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        await StorageService.removeTrackFromPlaylist(
                            playlist.id,
                            track.id,
                            track.source
                        );
                        loadPlaylist();
                    },
                },
            ]
        );
    };

    const formatDuration = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${String(secs).padStart(2, '0')}`;
    };

    const totalDuration = playlist.tracks.reduce((acc, t) => acc + (t.duration || 0), 0);

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={playerState.currentSong ? musicColors.gradientColors : ['#1a1a2e', '#0a0a0a', '#0a0a0a']}
                style={StyleSheet.absoluteFillObject}
            />

            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <ChevronLeft color="#fff" size={28} />
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {/* Playlist Header */}
                <View style={styles.playlistHeader}>
                    <View style={styles.playlistHeaderContent}>
                        {playlist.coverArt ? (
                            <Image
                                source={{ uri: playlist.coverArt }}
                                style={styles.playlistCover}
                                contentFit="cover"
                            />
                        ) : (
                            <View style={[styles.playlistCover, styles.playlistCoverPlaceholder]}>
                                <ListMusic color="#555" size={40} />
                            </View>
                        )}
                        <View style={styles.playlistInfo}>
                            <Text style={styles.playlistTitle} numberOfLines={2}>
                                {playlist.name}
                            </Text>
                            <View style={styles.playlistMeta}>
                                <Text style={styles.playlistMetaText}>
                                    {playlist.tracks.length} songs
                                    {playlist.tracks.length > 0 && ` • ${Math.floor(totalDuration / 60)} min`}
                                </Text>
                            </View>
                        </View>
                    </View>
                    {playlist.description && (
                        <Text style={styles.playlistDescription} numberOfLines={2}>
                            {playlist.description}
                        </Text>
                    )}
                </View>

                {/* Action Buttons */}
                <View style={styles.actionButtons}>
                    <TouchableOpacity
                        style={[
                            styles.playAllButton,
                            playlist.tracks.length === 0 && styles.buttonDisabled,
                        ]}
                        onPress={handlePlayAll}
                        disabled={playlist.tracks.length === 0}
                    >
                        <Play color="#000" size={20} fill="#000" />
                        <Text style={styles.playAllText}>Play All</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.shuffleButton,
                            playlist.tracks.length === 0 && styles.buttonDisabled,
                        ]}
                        onPress={handleShuffle}
                        disabled={playlist.tracks.length === 0}
                    >
                        <Shuffle color="#fff" size={20} />
                    </TouchableOpacity>
                </View>

                {/* Track List */}
                {playlist.tracks.length === 0 ? (
                    <View style={styles.emptyState}>
                        <ListMusic color="#555" size={48} />
                        <Text style={styles.emptyTitle}>No Tracks Yet</Text>
                        <Text style={styles.emptySubtitle}>
                            Add songs from the music player
                        </Text>
                    </View>
                ) : (
                    <View style={styles.trackList}>
                        {playlist.tracks.map((track, index) => (
                            <TouchableOpacity
                                key={`${track.id}-${index}`}
                                style={styles.trackItem}
                                onPress={() => handlePlayTrack(index)}
                                onLongPress={() => handleRemoveTrack(track, index)}
                            >
                                <Image
                                    source={{ uri: track.coverArt || undefined }}
                                    style={styles.trackCover}
                                    contentFit="cover"
                                />
                                <View style={styles.trackInfo}>
                                    <Text style={styles.trackTitle} numberOfLines={1}>
                                        {track.title}
                                    </Text>
                                    <Text style={styles.trackArtist} numberOfLines={1}>
                                        {track.artist}
                                    </Text>
                                </View>
                                <Text style={styles.trackDuration}>
                                    {formatDuration(track.duration || 0)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {/* Spacer for mini player */}
                <View style={{ height: 120 }} />
            </ScrollView>

            {/* Mini Player */}
            <MusicMiniPlayer navigation={navigation} />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a0a',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 8,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flex: 1,
    },
    playlistHeader: {
        paddingHorizontal: 16,
        paddingTop: 0,
        paddingBottom: 16,
    },
    playlistHeaderContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    playlistCover: {
        width: 120,
        height: 120,
        borderRadius: 12,
    },
    playlistCoverPlaceholder: {
        backgroundColor: '#1f1f1f',
        justifyContent: 'center',
        alignItems: 'center',
    },
    playlistInfo: {
        flex: 1,
        marginLeft: 16,
    },
    playlistTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 8,
    },
    playlistDescription: {
        fontSize: 12,
        color: '#888',
        marginTop: 12,
        lineHeight: 16,
    },
    playlistMeta: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    playlistMetaText: {
        fontSize: 14,
        color: '#A78BFA',
    },
    actionButtons: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
        paddingHorizontal: 24,
        marginBottom: 24,
    },
    playAllButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#A78BFA',
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 30,
    },
    playAllText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000',
    },
    shuffleButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    emptyState: {
        alignItems: 'center',
        paddingTop: 40,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        marginTop: 16,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#888',
        marginTop: 8,
    },
    trackList: {
        paddingHorizontal: 16,
    },
    trackItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderRadius: 8,
    },
    trackCover: {
        width: 48,
        height: 48,
        borderRadius: 6,
        backgroundColor: '#1f1f1f',
    },
    trackInfo: {
        flex: 1,
        marginLeft: 12,
    },
    trackTitle: {
        fontSize: 15,
        fontWeight: '500',
        color: '#fff',
        marginBottom: 4,
    },
    trackArtist: {
        fontSize: 13,
        color: '#888',
    },
    trackDuration: {
        fontSize: 13,
        color: '#666',
        marginLeft: 12,
    },
});

export default UserPlaylistScreen;
