import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
    Platform,
    StatusBar,
    Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import {
    ChevronDown,
    Play,
    Pause,
    SkipBack,
    SkipForward,
    Shuffle,
    Repeat,
    ListMusic,
    FileText,
    Download,
    Heart,
    Plus,
} from 'lucide-react-native';
import { Image } from 'expo-image';
import Slider from '@react-native-community/slider';
import { useProgress } from 'react-native-track-player';
import {
    getState,
    togglePlayPause,
    skipNext,
    skipPrevious,
    seekTo,
    toggleShuffle,
    toggleRepeat,
    addPlaybackListener,
    PlaybackState,
} from '../services/musicPlayerService';
import { MusicLyricsModal } from '../components/MusicLyricsModal';
import { MusicQueueModal } from '../components/MusicQueueModal';
import { AddToPlaylistModal } from '../components/AddToPlaylistModal';
import { useMusicColors } from '../hooks/useMusicColors';
import { StorageService, LikedSong } from '../services/storage';

const { width, height } = Dimensions.get('window');

interface MusicPlayerScreenProps {
    navigation: any;
    route: any;
}

export const MusicPlayerScreen = ({ navigation, route }: MusicPlayerScreenProps) => {
    const insets = useSafeAreaInsets();
    const musicColors = useMusicColors();
    const [state, setState] = useState<PlaybackState>(getState());
    const [isSeeking, setIsSeeking] = useState(false);
    const [seekPosition, setSeekPosition] = useState(0);
    const [showLyrics, setShowLyrics] = useState(false);
    const [showQueue, setShowQueue] = useState(false);
    const [showAddToPlaylist, setShowAddToPlaylist] = useState(false);
    const [isFavorite, setIsFavorite] = useState(false);

    useEffect(() => {
        const unsubscribe = addPlaybackListener(setState);
        return unsubscribe;
    }, []);

    // Check if current song is liked when song changes
    useEffect(() => {
        const checkLikedStatus = async () => {
            const currentSong = state.currentSong;
            if (currentSong && currentSong.source) {
                const liked = await StorageService.isLiked(currentSong.id, currentSong.source);
                setIsFavorite(liked);
            }
        };
        checkLikedStatus();
    }, [state.currentSong?.id]);

    const song = state.currentSong;
    if (!song) {
        navigation.goBack();
        return null;
    }

    // Use react-native-track-player's useProgress hook for smoother updates
    const { position, buffered, duration: streamDuration } = useProgress(200); // Update every 200ms for faster response

    // Reset seek state when song changes to prevent stale values
    useEffect(() => {
        setIsSeeking(false);
        setSeekPosition(0);
    }, [song?.id]);

    // FIXED: Use streamDuration from TrackPlayer as PRIMARY once available (> 0)
    // Only fall back to song.duration while stream is still loading
    // This ensures slider matches actual playback position
    const duration = (streamDuration > 0) ? streamDuration : (song.duration || 1);

    // Debug logging to track progress issues
    useEffect(() => {
        if (position > 0) {
            console.log(`[SeekBar] pos=${position.toFixed(1)}s, streamDur=${streamDuration.toFixed(1)}s, songDur=${song.duration}, progress=${(position / duration * 100).toFixed(1)}%`);
        }
    }, [Math.floor(position / 5)]); // Log every 5 seconds

    // Safe progress calculation - prevent NaN and ensure 0-1 range
    const rawProgress = position / duration;
    const progress = (isNaN(rawProgress) || !isFinite(rawProgress)) ? 0 : Math.max(0, Math.min(1, rawProgress));

    const bufferedProgress = duration > 0 ? Math.min(buffered / duration, 1) : 0;
    const currentTime = formatTime(position * 1000);
    // Use duration for total time display (now uses streamDuration when available)
    const totalTime = formatTime(duration * 1000);

    const handlePlayPause = async () => {
        await togglePlayPause();
    };

    const handlePrevious = async () => {
        await skipPrevious();
    };

    const handleNext = async () => {
        await skipNext();
    };

    const handleSeekStart = () => {
        console.log('[MusicPlayer] Seek started, current progress:', progress);
        setIsSeeking(true);
        setSeekPosition(progress);
    };

    const handleSeekChange = (value: number) => {
        console.log('[MusicPlayer] Seeking to:', value);
        setSeekPosition(value);
    };

    const handleSeekEnd = async (value: number) => {
        console.log('[MusicPlayer] Seek ended, seeking to position:', value, 'duration:', duration);
        setIsSeeking(false);
        const positionMs = value * duration * 1000; // duration is in seconds
        console.log('[MusicPlayer] Calling seekTo with ms:', positionMs);
        await seekTo(positionMs);
    };

    // Handle tap on progress bar to seek directly
    const handleProgressTap = async (event: any) => {
        const { locationX } = event.nativeEvent;
        const progressBarWidth = width - 48; // Account for container padding (24 each side)
        const tapProgress = Math.max(0, Math.min(1, locationX / progressBarWidth));
        console.log('[MusicPlayer] Tap to seek:', tapProgress, 'at x:', locationX);
        const positionMs = tapProgress * duration * 1000;
        await seekTo(positionMs);
    };

    const handleShuffle = async () => {
        await toggleShuffle();
    };

    const handleRepeat = async () => {
        await toggleRepeat();
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* Background gradient based on album art */}
            <LinearGradient
                colors={musicColors.gradientColors}
                style={StyleSheet.absoluteFillObject}
            />

            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
                <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => navigation.goBack()}
                >
                    <ChevronDown color="#fff" size={28} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Now Playing</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                    {/* Add to Playlist button */}
                    <TouchableOpacity
                        style={styles.favoriteButton}
                        onPress={() => setShowAddToPlaylist(true)}
                    >
                        <Plus color="#fff" size={24} />
                    </TouchableOpacity>
                    {/* Heart/Like button */}
                    <TouchableOpacity
                        style={styles.favoriteButton}
                        onPress={async () => {
                            if (!song) return;
                            const likedSong: LikedSong = {
                                id: song.id,
                                title: song.title,
                                artist: song.artist,
                                artistId: song.artistId || '',
                                album: song.album || '',
                                albumId: song.albumId || '',
                                duration: song.duration || 0,
                                coverArt: song.coverArt || null,
                                quality: song.suffix || 'FLAC',
                                source: song.source || 'hifi',
                                likedAt: Date.now(),
                            };
                            const isNowLiked = await StorageService.toggleLiked(likedSong);
                            setIsFavorite(isNowLiked);
                        }}
                    >
                        <Heart
                            color={isFavorite ? '#EF4444' : '#fff'}
                            size={24}
                            fill={isFavorite ? '#EF4444' : 'transparent'}
                        />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Album Art */}
            <View style={styles.artworkContainer}>
                <Image
                    source={{ uri: song.coverArt || undefined }}
                    style={styles.artwork}
                    contentFit="cover"
                />
            </View>

            {/* Track Info */}
            <View style={styles.infoContainer}>
                <BlurView intensity={40} tint="dark" style={styles.infoBlur}>
                    <View style={styles.infoContent}>
                        <Text style={styles.trackTitle} numberOfLines={1}>
                            {song.title}
                        </Text>
                        <Text style={styles.artistName} numberOfLines={1}>
                            {song.artist}
                        </Text>
                        <Text style={styles.albumName} numberOfLines={1}>
                            {song.album}
                        </Text>
                        <View style={styles.badgesRow}>
                            <View style={[
                                styles.qualityBadge,
                                song.source === 'qobuz' && { backgroundColor: 'rgba(168, 85, 247, 0.2)' }
                            ]}>
                                <Text style={[
                                    styles.qualityText,
                                    song.source === 'qobuz' && { color: '#A855F7' }
                                ]}>
                                    {song.source === 'qobuz'
                                        ? 'FLAC • 24-bit • 96kHz'
                                        : `FLAC • ${song.suffix?.toUpperCase() || '16-bit'} • 44.1kHz`}
                                </Text>
                            </View>
                            <View style={[
                                styles.sourceBadge,
                                song.source === 'qobuz'
                                    ? { backgroundColor: 'rgba(168, 85, 247, 0.15)' }
                                    : song.source === 'tidal'
                                        ? styles.sourceBadgeSecondary
                                        : styles.sourceBadgePrimary
                            ]}>
                                <Text style={[
                                    styles.sourceText,
                                    song.source === 'qobuz'
                                        ? { color: '#A855F7' }
                                        : song.source === 'tidal'
                                            ? styles.sourceTextSecondary
                                            : styles.sourceTextPrimary
                                ]}>
                                    {song.source === 'qobuz' ? 'HI-RES' : song.source === 'tidal' ? 'TIDAL' : 'PRIMARY'}
                                </Text>
                            </View>
                        </View>
                    </View>
                </BlurView>
            </View>

            {/* Progress Bar - Tap anywhere to seek */}
            <View style={styles.progressContainer}>
                <Pressable onPress={handleProgressTap} style={styles.progressTouchable}>
                    <Slider
                        key={`slider-${song?.id}`}
                        style={styles.slider}
                        minimumValue={0}
                        maximumValue={1}
                        value={isSeeking ? Math.max(0, Math.min(1, seekPosition)) : progress}
                        minimumTrackTintColor="#A78BFA"
                        maximumTrackTintColor="rgba(255, 255, 255, 0.2)"
                        thumbTintColor="#fff"
                        onSlidingStart={handleSeekStart}
                        onValueChange={handleSeekChange}
                        onSlidingComplete={handleSeekEnd}
                    />
                </Pressable>
                <View style={styles.timeContainer}>
                    <Text style={styles.timeText}>{isSeeking ? formatTime(seekPosition * duration * 1000) : currentTime}</Text>
                    <Text style={styles.timeText}>{totalTime}</Text>
                </View>
            </View>

            {/* Controls - with proper bottom padding */}
            <View style={[styles.controlsContainer, { marginBottom: 20 + insets.bottom }]}>
                <TouchableOpacity
                    style={[styles.secondaryControl, state.shuffleEnabled && styles.activeControl]}
                    onPress={handleShuffle}
                >
                    <Shuffle color={state.shuffleEnabled ? '#10B981' : '#fff'} size={22} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.controlButton} onPress={handlePrevious}>
                    <SkipBack color="#fff" size={32} fill="#fff" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.playButton} onPress={handlePlayPause}>
                    {state.isPlaying ? (
                        <Pause color="#000" size={36} fill="#000" />
                    ) : (
                        <Play color="#000" size={36} fill="#000" />
                    )}
                </TouchableOpacity>

                <TouchableOpacity style={styles.controlButton} onPress={handleNext}>
                    <SkipForward color="#fff" size={32} fill="#fff" />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.secondaryControl, state.repeatMode !== 'off' && styles.activeControl]}
                    onPress={handleRepeat}
                >
                    <Repeat color={state.repeatMode !== 'off' ? '#10B981' : '#fff'} size={22} />
                </TouchableOpacity>
            </View>

            {/* Action Buttons - removed since controls now have proper spacing */}

            {/* Modals */}
            <MusicLyricsModal
                visible={showLyrics}
                onClose={() => setShowLyrics(false)}
                song={song}
                positionMs={state.positionMs}
            />

            <MusicQueueModal
                visible={showQueue}
                onClose={() => setShowQueue(false)}
            />

            {/* Add to Playlist Modal */}
            {song && (
                <AddToPlaylistModal
                    visible={showAddToPlaylist}
                    onClose={() => setShowAddToPlaylist(false)}
                    track={{
                        id: song.id,
                        title: song.title,
                        artist: song.artist,
                        artistId: song.artistId || '',
                        album: song.album || '',
                        albumId: song.albumId || '',
                        duration: song.duration || 0,
                        coverArt: song.coverArt,
                        source: song.source || 'hifi',
                    }}
                />
            )}
        </View>
    );
};

function formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a0a',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    closeButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#888',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    favoriteButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    artworkContainer: {
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 30,
    },
    artwork: {
        width: width - 80,
        height: width - 80,
        borderRadius: 16,
        backgroundColor: '#1a1a1a',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.5,
        shadowRadius: 30,
        elevation: 20,
    },
    infoContainer: {
        marginHorizontal: 24,
        marginBottom: 24,
    },
    infoBlur: {
        borderRadius: 16,
        overflow: 'hidden',
    },
    infoContent: {
        padding: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
    },
    trackTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#fff',
        textAlign: 'center',
    },
    artistName: {
        fontSize: 16,
        color: '#888',
        marginTop: 4,
        textAlign: 'center',
    },
    albumName: {
        fontSize: 14,
        color: '#666',
        marginTop: 2,
        textAlign: 'center',
    },
    qualityBadge: {
        backgroundColor: 'rgba(168, 85, 247, 0.15)',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    qualityText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#A855F7',
    },
    badgesRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        marginTop: 12,
    },
    sourceBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    sourceBadgePrimary: {
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
    },
    sourceBadgeSecondary: {
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
    },
    sourceText: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    sourceTextPrimary: {
        color: '#10B981',
    },
    sourceTextSecondary: {
        color: '#3B82F6',
    },
    progressContainer: {
        marginHorizontal: 24,
        marginBottom: 24,
    },
    slider: {
        width: '100%',
        height: 40,
    },
    progressTouchable: {
        width: '100%',
    },
    progressTrack: {
        height: 50,
        justifyContent: 'center',
        paddingVertical: 20,
    },
    progressBackground: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 22,
        height: 6,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 3,
    },
    progressFill: {
        position: 'absolute',
        left: 0,
        top: 22,
        height: 6,
        backgroundColor: '#10B981',
        borderRadius: 3,
    },
    progressThumb: {
        position: 'absolute',
        top: 17,
        marginLeft: -8,
        width: 16,
        height: 16,
        backgroundColor: '#fff',
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    timeContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: -8,
    },
    timeText: {
        fontSize: 12,
        color: '#666',
    },
    controlsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        marginBottom: 32,
    },
    secondaryControl: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    activeControl: {
        opacity: 1,
    },
    controlButton: {
        width: 56,
        height: 56,
        justifyContent: 'center',
        alignItems: 'center',
    },
    playButton: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 16,
    },
    actionsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 40,
        paddingBottom: 20,
    },
    actionButton: {
        alignItems: 'center',
        gap: 4,
    },
    actionText: {
        fontSize: 12,
        color: '#888',
    },
});
