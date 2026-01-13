import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Dimensions,
    Platform,
    RefreshControl,
    Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
    ChevronLeft,
    Search,
    ChevronRight,
    Music2,
    Disc3,
    User,
    ListMusic,
    Play,
    Headphones,
    Zap,
    Radio,
    Heart,
    Settings,
} from 'lucide-react-native';
import { Image } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';
import { MusicMiniPlayer } from '../components/MusicMiniPlayer';
import {
    search,
    searchHiFiOnly,
    searchTidalOnly,
    searchQobuzOnly,
    MusicSearchResult,
    MusicTrack,
    MusicAlbum,
    MusicArtist,
    MusicPlaylist,
} from '../services/hifi';
import {
    playQueue,
    playSong,
    getState,
    addPlaybackListener,
    PlaybackState,
} from '../services/musicPlayerService';
import { useMusicColors } from '../hooks/useMusicColors';
import { StorageService, MusicSourceType } from '../services/storage';

const { width, height } = Dimensions.get('window');

type TabType = 'tracks' | 'albums' | 'artists' | 'playlists';

interface MusicHomeScreenProps {
    navigation: any;
}

export const MusicHomeScreen = ({ navigation }: MusicHomeScreenProps) => {
    const insets = useSafeAreaInsets();
    const musicColors = useMusicColors();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<TabType>('tracks');
    const [loading, setLoading] = useState(false);
    const [searchResults, setSearchResults] = useState<MusicSearchResult | null>(null);
    const [playerState, setPlayerState] = useState<PlaybackState>(getState());
    const [refreshing, setRefreshing] = useState(false);
    const [musicSource, setMusicSource] = useState<MusicSourceType>('hifi');

    // Subscribe to player state on mount
    useEffect(() => {
        const unsubscribe = addPlaybackListener(setPlayerState);
        return unsubscribe;
    }, []);

    // Load music source preference when screen is focused
    useFocusEffect(
        useCallback(() => {
            const loadMusicSource = async () => {
                const source = await StorageService.getMusicSource();
                setMusicSource(source);
                // If on playlists tab and switching to hifi, reset to tracks
                if (source === 'hifi' && activeTab === 'playlists') {
                    setActiveTab('tracks');
                }
            };
            loadMusicSource();
        }, [activeTab])
    );

    // Handle search
    const handleSearch = useCallback(async () => {
        if (!searchQuery.trim()) {
            console.log('[Music] Search: Empty query, skipping');
            return;
        }

        console.log('[Music] Searching for:', searchQuery, 'using source:', musicSource);
        setLoading(true);
        try {
            // Use source-specific search based on user preference
            let results: MusicSearchResult | null = null;
            if (musicSource === 'hifi') {
                results = await searchHiFiOnly(searchQuery);
            } else if (musicSource === 'tidal') {
                results = await searchTidalOnly(searchQuery);
            } else if (musicSource === 'qobuz') {
                results = await searchQobuzOnly(searchQuery);
            } else {
                results = await search(searchQuery);
            }

            console.log('[Music] Search results:', results);
            if (results) {
                setSearchResults(results);
                const trackCount = results.tracks?.length || 0;
                const albumCount = results.albums?.length || 0;
                const artistCount = results.artists?.length || 0;
                console.log('[Music] Found tracks:', trackCount, 'albums:', albumCount, 'artists:', artistCount);
                // Show no results feedback
                if (trackCount === 0 && albumCount === 0 && artistCount === 0) {
                    Alert.alert('No Results', `No results found for "${searchQuery}" on ${musicSource.toUpperCase()}`);
                }
            } else {
                console.log('[Music] Search returned null');
                Alert.alert('Search Failed', 'Could not get results. Please try again.');
            }
        } catch (error) {
            console.error('[Music] Search error:', error);
            Alert.alert('Search Error', 'Failed to search: ' + (error as Error).message);
        } finally {
            setLoading(false);
        }
    }, [searchQuery, musicSource]);


    // Search on enter
    const handleSubmit = () => {
        console.log('[Music] Handle submit called, query:', searchQuery);
        if (!searchQuery.trim()) {
            Alert.alert('Empty Search', 'Please enter a search term');
            return;
        }
        handleSearch();
    };

    // Play a track
    const handlePlayTrack = async (track: MusicTrack, allTracks: MusicTrack[], index: number) => {
        console.log('[Home] handlePlayTrack called - track:', track.title, 'source:', track.source, 'id:', track.id);
        try {
            // For TIDAL/Qobuz: play ONLY the clicked track to avoid mismatch issues
            if (track.source === 'tidal' || track.source === 'qobuz') {
                console.log('[Home] Playing single track:', track.title, 'ID:', track.id);
                await playSong({
                    id: track.id,
                    title: track.title,
                    artist: track.artist,
                    artistId: track.artistId,
                    album: track.album,
                    albumId: track.albumId,
                    duration: track.duration,
                    coverArt: track.coverArt || undefined,
                    suffix: track.suffix || 'flac',
                    size: 0,
                    contentType: 'audio/flac',
                    source: track.source,
                });
            } else {
                // HiFi: use full queue (works correctly)
                const songs = allTracks.map(t => ({
                    id: t.id,
                    title: t.title,
                    artist: t.artist,
                    artistId: t.artistId,
                    album: t.album,
                    albumId: t.albumId,
                    duration: t.duration,
                    coverArt: t.coverArt || undefined,
                    suffix: t.suffix || 'flac',
                    size: 0,
                    contentType: 'audio/flac',
                    source: t.source,
                }));
                await playQueue(songs as any, index);
            }
        } catch (error) {
            console.error('Error playing track:', error);
            Alert.alert('Playback Error', 'Failed to play track');
        }
    };

    // Navigate to album detail
    const handleAlbumPress = (album: MusicAlbum) => {
        navigation.navigate('MusicAlbum', { album });
    };

    // Navigate to artist detail
    const handleArtistPress = (artist: MusicArtist) => {
        navigation.navigate('MusicArtist', { artist });
    };

    // Refresh
    const onRefresh = async () => {
        setRefreshing(true);
        if (searchQuery.trim()) {
            await handleSearch();
        }
        setRefreshing(false);
    };

    const renderTabContent = () => {
        if (loading) {
            return (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#A78BFA" />
                    <Text style={styles.loadingText}>Searching...</Text>
                </View>
            );
        }

        if (!searchResults) {
            return (
                <View style={styles.featuresSection}>
                    {/* News Card */}
                    <LinearGradient
                        colors={['rgba(59, 130, 246, 0.2)', 'rgba(139, 92, 246, 0.1)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.newsCard}
                    >
                        <Text style={styles.newsCardTitle}>🎵 Welcome to This Is Music</Text>
                        <View style={styles.newsItem}>
                            <View style={styles.newsItemIcon}>
                                <Headphones color="#A78BFA" size={20} />
                            </View>
                            <View style={styles.newsItemContent}>
                                <Text style={styles.newsItemTitle}>CD-Quality Streaming</Text>
                                <Text style={styles.newsItemDesc}>
                                    Stream lossless FLAC audio directly to your device
                                </Text>
                            </View>
                        </View>
                        <View style={styles.newsItem}>
                            <View style={styles.newsItemIcon}>
                                <Zap color="#F59E0B" size={20} />
                            </View>
                            <View style={styles.newsItemContent}>
                                <Text style={styles.newsItemTitle}>Fast & Reliable</Text>
                                <Text style={styles.newsItemDesc}>
                                    Powered by multiple APIs for instant playback
                                </Text>
                            </View>
                        </View>
                        <View style={styles.newsItem}>
                            <View style={styles.newsItemIcon}>
                                <Radio color="#10B981" size={20} />
                            </View>
                            <View style={styles.newsItemContent}>
                                <Text style={styles.newsItemTitle}>Search Everything</Text>
                                <Text style={styles.newsItemDesc}>
                                    Find tracks, albums, and artists instantly
                                </Text>
                            </View>
                        </View>
                    </LinearGradient>


                </View>
            );
        }

        switch (activeTab) {
            case 'tracks':
                return <View key={`tab-tracks-${searchResults?.source}`}>{renderTracks()}</View>;
            case 'albums':
                return <View key={`tab-albums-${searchResults?.source}`}>{renderAlbums()}</View>;
            case 'artists':
                return <View key={`tab-artists-${searchResults?.source}`}>{renderArtists()}</View>;
            case 'playlists':
                return <View key={`tab-playlists-${searchResults?.source}`}>{renderPlaylists()}</View>;
            default:
                return null;
        }
    };

    const renderTracks = () => {
        const tracks = searchResults?.tracks || [];
        if (tracks.length === 0) {
            return (
                <View style={styles.emptyResults}>
                    <Text style={styles.emptyResultsText}>No tracks found</Text>
                </View>
            );
        }

        return (
            <View style={styles.trackList}>
                {tracks.map((track, index) => (
                    <TouchableOpacity
                        key={track.id}
                        style={styles.trackItem}
                        onPress={() => handlePlayTrack(track, tracks, index)}
                    >
                        <Image
                            source={{ uri: track.coverArt || undefined }}
                            style={styles.trackCover}
                            contentFit="cover"
                        />
                        <View style={styles.trackInfo}>
                            <Text style={styles.trackTitle} numberOfLines={1}>{track.title}</Text>
                            <Text style={styles.trackArtist} numberOfLines={1}>{track.artist}</Text>
                        </View>
                        <View style={styles.trackMeta}>
                            <Text style={styles.trackQuality}>{track.quality || 'FLAC'}</Text>
                            <Text style={styles.trackDuration}>
                                {Math.floor((track.duration || 0) / 60)}:{String((track.duration || 0) % 60).padStart(2, '0')}
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={styles.playButton}
                            onPress={() => handlePlayTrack(track, tracks, index)}
                        >
                            <Play color="#fff" size={16} fill="#fff" />
                        </TouchableOpacity>
                    </TouchableOpacity>
                ))}
            </View>
        );
    };

    const renderAlbums = () => {
        const albums = searchResults?.albums || [];
        if (albums.length === 0) {
            return (
                <View style={styles.emptyResults}>
                    <Text style={styles.emptyResultsText}>No albums found</Text>
                </View>
            );
        }

        return (
            <View style={styles.albumGrid}>
                {albums.map((album) => (
                    <TouchableOpacity
                        key={album.id}
                        style={styles.albumCard}
                        onPress={() => handleAlbumPress(album)}
                    >
                        <Image
                            source={{ uri: album.coverArt || undefined }}
                            style={styles.albumCover}
                            contentFit="cover"
                        />
                        <Text style={styles.albumTitle} numberOfLines={1}>{album.name}</Text>
                        <Text style={styles.albumArtist} numberOfLines={1}>{album.artist}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        );
    };

    const renderArtists = () => {
        const artists = searchResults?.artists || [];
        if (artists.length === 0) {
            return (
                <View style={styles.emptyResults}>
                    <Text style={styles.emptyResultsText}>No artists found</Text>
                </View>
            );
        }

        return (
            <View style={styles.artistList}>
                {artists.map((artist) => (
                    <TouchableOpacity
                        key={artist.id}
                        style={styles.artistItem}
                        onPress={() => handleArtistPress(artist)}
                    >
                        <View style={styles.artistAvatar}>
                            {artist.picture ? (
                                <Image
                                    source={{ uri: artist.picture }}
                                    style={styles.artistImage}
                                    contentFit="cover"
                                />
                            ) : (
                                <User color="#888" size={32} />
                            )}
                        </View>
                        <View style={styles.artistInfo}>
                            <Text style={styles.artistName}>{artist.name}</Text>
                            <Text style={styles.artistMeta}>Artist</Text>
                        </View>
                        <ChevronRight color="#555" size={20} />
                    </TouchableOpacity>
                ))}
            </View>
        );
    };

    // Navigate to playlist detail
    const handlePlaylistPress = (playlist: MusicPlaylist) => {
        navigation.navigate('MusicPlaylist', { playlist });
    };

    const renderPlaylists = () => {
        const playlists = searchResults?.playlists || [];
        if (playlists.length === 0) {
            return (
                <View style={styles.emptyResults}>
                    <Text style={styles.emptyResultsText}>No playlists found</Text>
                </View>
            );
        }

        return (
            <View style={styles.albumGrid}>
                {playlists.map((playlist) => (
                    <TouchableOpacity
                        key={playlist.id}
                        style={styles.albumCard}
                        onPress={() => handlePlaylistPress(playlist)}
                    >
                        {playlist.coverArt ? (
                            <Image
                                source={{ uri: playlist.coverArt }}
                                style={styles.albumCover}
                                contentFit="cover"
                            />
                        ) : (
                            <View style={[styles.albumCover, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#1f1f1f' }]}>
                                <ListMusic color="#555" size={40} />
                            </View>
                        )}
                        <Text style={styles.albumTitle} numberOfLines={1}>
                            {playlist.name}
                        </Text>
                        <Text style={styles.albumArtist} numberOfLines={1}>
                            {playlist.trackCount} tracks
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* Dynamic Gradient Background based on current song */}
            <LinearGradient
                colors={playerState.currentSong ? musicColors.gradientColors : ['#1a1033', '#0d1b2a', '#0a0a14']}
                style={StyleSheet.absoluteFillObject}
            />

            {/* Hero Section */}
            <LinearGradient
                colors={['rgba(139, 92, 246, 0.3)', 'rgba(59, 130, 246, 0.15)', 'transparent']}
                style={[styles.heroGradient, { paddingTop: insets.top + 12 }]}
            >
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <ChevronLeft color="#fff" size={28} />
                    </TouchableOpacity>
                    <View style={styles.headerRightButtons}>
                        {/* Playlists button */}
                        <TouchableOpacity
                            style={styles.headerButton}
                            onPress={() => navigation.navigate('MyPlaylists')}
                        >
                            <ListMusic color="#A78BFA" size={22} />
                        </TouchableOpacity>
                        {/* Library button */}
                        <TouchableOpacity
                            style={styles.headerButton}
                            onPress={() => navigation.navigate('MusicLibrary')}
                        >
                            <Heart color="#A78BFA" size={22} fill="#A78BFA" />
                        </TouchableOpacity>
                        {/* Settings button */}
                        <TouchableOpacity
                            style={styles.headerButton}
                            onPress={() => navigation.navigate('MusicSettings')}
                        >
                            <Settings color="#A78BFA" size={22} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Hero Title */}
                <View style={[styles.heroContent, { alignItems: 'center' }]}>
                    <Text style={[styles.heroTitle, { textAlign: 'center' }]}>This Is Music</Text>
                    <Text style={styles.heroVersion}>v1.0</Text>
                </View>
                <Text style={[styles.heroSubtitle, { textAlign: 'center' }]}>
                    Stream CD-quality lossless FLACs
                </Text>

                {/* Search Bar */}
                <View style={styles.searchContainer}>
                    <View style={styles.searchInputContainer}>
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search for tracks, albums, artists..."
                            placeholderTextColor="#6B7280"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            onSubmitEditing={handleSubmit}
                            returnKeyType="search"
                        />
                        <TouchableOpacity style={styles.searchButton} onPress={handleSubmit}>
                            <Search color="#fff" size={20} />
                        </TouchableOpacity>
                    </View>
                </View>
            </LinearGradient>

            {/* Tabs */}
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'tracks' && styles.tabActive]}
                    onPress={() => setActiveTab('tracks')}
                >
                    <Music2 color={activeTab === 'tracks' ? '#A78BFA' : '#6B7280'} size={16} />
                    <Text style={[styles.tabText, activeTab === 'tracks' && styles.tabTextActive]}>
                        Tracks
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'albums' && styles.tabActive]}
                    onPress={() => setActiveTab('albums')}
                >
                    <Disc3 color={activeTab === 'albums' ? '#A78BFA' : '#6B7280'} size={16} />
                    <Text style={[styles.tabText, activeTab === 'albums' && styles.tabTextActive]}>
                        Albums
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'artists' && styles.tabActive]}
                    onPress={() => setActiveTab('artists')}
                >
                    <User color={activeTab === 'artists' ? '#A78BFA' : '#6B7280'} size={16} />
                    <Text style={[styles.tabText, activeTab === 'artists' && styles.tabTextActive]}>
                        Artists
                    </Text>
                </TouchableOpacity>
                {/* Playlists tab - show for TIDAL only (HiFi doesn't support playlists, Qobuz API doesn't support fetching playlist tracks) */}
                {musicSource === 'tidal' && (
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'playlists' && styles.tabActive]}
                        onPress={() => setActiveTab('playlists')}
                    >
                        <ListMusic color={activeTab === 'playlists' ? '#A78BFA' : '#6B7280'} size={16} />
                        <Text style={[styles.tabText, activeTab === 'playlists' && styles.tabTextActive]}>
                            Playlists
                        </Text>
                    </TouchableOpacity>
                )}
                <View style={styles.tabDivider} />
            </View>

            {/* Content */}
            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor="#10B981"
                    />
                }
            >
                {renderTabContent()}
                {/* Spacer for mini player */}
                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Mini Player */}
            {playerState.currentSong && (
                <MusicMiniPlayer
                    navigation={navigation}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a0a',
    },
    headerWrapper: {
        backgroundColor: 'transparent',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 10 : 10,
        paddingBottom: 12,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerRightButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(167, 139, 250, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    libraryButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(167, 139, 250, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
    },
    searchContainer: {
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    searchBlur: {
        borderRadius: 14,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    searchInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(13, 27, 42, 0.8)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.3)',
        paddingLeft: 16,
        paddingRight: 4,
        paddingVertical: 4,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: '#fff',
        paddingVertical: 10,
    },
    tabContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        marginBottom: 16,
        gap: 8,
    },
    tab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: 'transparent',
        gap: 6,
    },
    tabActive: {
        backgroundColor: 'rgba(167, 139, 250, 0.15)',
    },
    tabText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#6B7280',
    },
    tabTextActive: {
        color: '#A78BFA',
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        paddingHorizontal: 16,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 100,
    },
    loadingText: {
        color: '#888',
        marginTop: 12,
        fontSize: 14,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 100,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#fff',
        marginTop: 16,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#666',
        marginTop: 8,
    },
    emptyResults: {
        paddingTop: 40,
        alignItems: 'center',
    },
    emptyResultsText: {
        color: '#666',
        fontSize: 16,
    },
    // Track styles
    trackList: {
        gap: 8,
    },
    trackItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    trackCover: {
        width: 48,
        height: 48,
        borderRadius: 8,
        backgroundColor: '#1a1a1a',
    },
    trackInfo: {
        flex: 1,
        marginLeft: 12,
    },
    trackTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#fff',
    },
    trackArtist: {
        fontSize: 13,
        color: '#888',
        marginTop: 2,
    },
    trackMeta: {
        alignItems: 'flex-end',
        marginRight: 12,
    },
    trackQuality: {
        fontSize: 10,
        fontWeight: '700',
        color: '#A855F7',
        backgroundColor: 'rgba(168, 85, 247, 0.15)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    trackDuration: {
        fontSize: 12,
        color: '#666',
        marginTop: 4,
    },
    playButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#10B981',
        justifyContent: 'center',
        alignItems: 'center',
    },
    // Album styles
    albumGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    albumCard: {
        width: (width - 48) / 2,
        marginBottom: 16,
    },
    albumCover: {
        width: '100%',
        aspectRatio: 1,
        borderRadius: 12,
        backgroundColor: '#1a1a1a',
    },
    albumTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
        marginTop: 8,
    },
    albumArtist: {
        fontSize: 12,
        color: '#888',
        marginTop: 2,
    },
    // Artist styles
    artistList: {
        gap: 8,
    },
    artistItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    artistAvatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#1a1a1a',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    artistImage: {
        width: '100%',
        height: '100%',
    },
    artistInfo: {
        flex: 1,
        marginLeft: 14,
    },
    artistName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    artistMeta: {
        fontSize: 13,
        color: '#888',
        marginTop: 2,
    },
    // Setup button styles
    setupButton: {
        backgroundColor: '#A78BFA',
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 12,
        marginTop: 16,
    },
    setupButtonText: {
        color: '#000',
        fontSize: 16,
        fontWeight: '600',
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        width: '100%',
        maxWidth: 400,
        backgroundColor: '#0d1b2a',
        borderRadius: 16,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(139, 92, 246, 0.3)',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
    },
    modalSubtitle: {
        fontSize: 14,
        color: '#9CA3AF',
        marginBottom: 20,
    },
    modalInput: {
        backgroundColor: 'rgba(13, 27, 42, 0.8)',
        borderRadius: 12,
        padding: 14,
        fontSize: 16,
        color: '#fff',
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.3)',
    },
    saveButton: {
        backgroundColor: '#A78BFA',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 8,
    },
    saveButtonText: {
        color: '#000',
        fontSize: 16,
        fontWeight: '600',
    },
    // Hero styles
    heroGradient: {
        paddingBottom: 20,
    },
    heroContent: {
        flexDirection: 'row',
        alignItems: 'baseline',
        paddingHorizontal: 16,
        marginTop: 8,
    },
    heroTitle: {
        fontSize: 32,
        fontWeight: '800',
        color: '#A78BFA',
        fontStyle: 'italic',
    },
    heroVersion: {
        fontSize: 14,
        color: '#6B7280',
        marginLeft: 8,
    },
    heroSubtitle: {
        fontSize: 15,
        color: '#9CA3AF',
        paddingHorizontal: 16,
        marginTop: 4,
        marginBottom: 16,
    },
    settingsButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(167, 139, 250, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    searchButton: {
        backgroundColor: '#A78BFA',
        width: 40,
        height: 40,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tabDivider: {
        flex: 1,
    },
    // Setup container styles
    setupContainer: {
        paddingHorizontal: 16,
    },
    featureCardGradient: {
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(139, 92, 246, 0.3)',
    },
    featureCard: {
        alignItems: 'center',
    },
    featureIconBox: {
        width: 60,
        height: 60,
        borderRadius: 16,
        backgroundColor: 'rgba(139, 92, 246, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    featureCardTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 8,
    },
    featureCardDesc: {
        fontSize: 14,
        color: '#9CA3AF',
        textAlign: 'center',
        marginBottom: 16,
    },
    // Features section styles
    featuresSection: {
        paddingHorizontal: 16,
        gap: 16,
    },
    newsCard: {
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(59, 130, 246, 0.3)',
    },
    newsCardTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 16,
        textAlign: 'center',
    },
    newsItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 14,
    },
    newsItemIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.08)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    newsItemContent: {
        flex: 1,
    },
    newsItemTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 4,
    },
    newsItemDesc: {
        fontSize: 13,
        color: '#6B7280',
        lineHeight: 18,
    },
    quickActions: {
        flexDirection: 'row',
        gap: 12,
    },
    quickActionCard: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 14,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    quickActionText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#9CA3AF',
        marginTop: 8,
    },
    // Connected state styles
    connectedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        alignSelf: 'flex-start',
        marginBottom: 20,
    },
    connectedDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#10B981',
        marginRight: 8,
    },
    connectedText: {
        color: '#10B981',
        fontSize: 14,
        fontWeight: '600',
    },
    credentialInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(167, 139, 250, 0.1)',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(167, 139, 250, 0.3)',
        marginBottom: 20,
    },
    credentialUsername: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 12,
    },
    removeButton: {
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
    },
    removeButtonText: {
        color: '#EF4444',
        fontSize: 16,
        fontWeight: '600',
    },
});
