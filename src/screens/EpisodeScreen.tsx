import React, { useEffect, useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    TouchableOpacity,
    ScrollView,
    Dimensions,
    Platform,
    StatusBar,
    ActivityIndicator,
    Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { X, ChevronDown, Play } from 'lucide-react-native';
import { getImageUrl, getSeasonDetails, getTVShowDetails } from '../services/tmdb';
import { TVShowDetails, SeasonDetails, Episode } from '../types/types';
import { TorrentResultsModal } from '../components/TorrentResultsModal';

const { width, height } = Dimensions.get('window');

interface EpisodeScreenProps {
    route: any;
    navigation: any;
}

export const EpisodeScreen = ({ route, navigation }: EpisodeScreenProps) => {
    const insets = useSafeAreaInsets();
    const { tvId, seasonNumber: initialSeason, showName, posterPath } = route.params;

    const [showDetails, setShowDetails] = useState<TVShowDetails | null>(null);
    const [seasonDetails, setSeasonDetails] = useState<SeasonDetails | null>(null);
    const [selectedSeason, setSelectedSeason] = useState<number>(initialSeason || 1);
    const [loading, setLoading] = useState(true);
    const [showSeasonPicker, setShowSeasonPicker] = useState(false);
    const [showTorrentModal, setShowTorrentModal] = useState(false);
    const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);

    // Animation refs
    const fadeAnims = useRef<Animated.Value[]>([]).current;

    useEffect(() => {
        fetchShowDetails();
    }, [tvId]);

    useEffect(() => {
        if (showDetails) {
            fetchSeasonDetails(selectedSeason);
        }
    }, [selectedSeason, showDetails]);

    const fetchShowDetails = async () => {
        try {
            const tmdbData = await getTVShowDetails(tvId);
            setShowDetails(tmdbData);
        } catch (error) {
            console.error('Error fetching show details:', error);
            // Use minimal fallback data
            setShowDetails({
                id: tvId,
                name: showName || 'Unknown Show',
                original_name: showName || 'Unknown Show',
                overview: '',
                poster_path: posterPath,
                backdrop_path: null,
                first_air_date: '',
                vote_average: 0,
                vote_count: 0,
                popularity: 0,
                genre_ids: [],
                origin_country: [],
                original_language: 'en',
                genres: [],
                episode_run_time: [],
                status: '',
                tagline: '',
                number_of_seasons: 1,
                number_of_episodes: 0,
                seasons: [],
                created_by: [],
                networks: [],
            } as TVShowDetails);
        }
    };

    const fetchSeasonDetails = async (seasonNum: number) => {
        setLoading(true);
        try {
            const tmdbSeasonData = await getSeasonDetails(tvId, seasonNum);
            setSeasonDetails(tmdbSeasonData);

            // Initialize fade animations
            fadeAnims.length = 0;
            tmdbSeasonData.episodes.forEach(() => {
                fadeAnims.push(new Animated.Value(0));
            });

            // Animate episodes
            Animated.stagger(
                60,
                fadeAnims.map((anim) =>
                    Animated.spring(anim, {
                        toValue: 1,
                        friction: 8,
                        tension: 40,
                        useNativeDriver: true,
                    })
                )
            ).start();
        } catch (error) {
            console.error('Error fetching season details:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDuration = (minutes: number): string => {
        if (!minutes) return '';
        return `${minutes} min`;
    };

    const getContentRating = (): string => {
        // This would come from API in real app
        return 'TV-MA';
    };

    const getYear = (dateStr: string): string => {
        if (!dateStr) return '';
        return dateStr.split('-')[0];
    };

    const handleEpisodePress = (episode: Episode) => {
        setSelectedEpisode(episode);
        setShowTorrentModal(true);
    };


    if (!showDetails) {
        return (
            <View style={[styles.container, styles.loadingContainer]}>
                <StatusBar barStyle="light-content" />
                <ActivityIndicator size="large" color="#fff" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* Background Gradient */}
            <LinearGradient
                colors={['#1a1a1a', '#0a0a0a', '#000']}
                style={styles.background}
            />

            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* Header with Close Button */}
                <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={() => navigation.goBack()}
                    >
                        <X color="#fff" size={24} />
                    </TouchableOpacity>
                </View>

                {/* Show Info Section */}
                <View style={styles.showInfoSection}>
                    {/* Poster */}
                    <View style={styles.posterContainer}>
                        <Image
                            source={{ uri: getImageUrl(posterPath || showDetails.poster_path, 'w342') }}
                            style={styles.poster}
                            resizeMode="cover"
                        />
                    </View>

                    {/* Details */}
                    <View style={styles.detailsContainer}>
                        {/* Network/Provider */}
                        {showDetails.networks && showDetails.networks[0] && (
                            <View style={styles.networkBadge}>
                                <Text style={styles.networkText}>
                                    {showDetails.networks[0].name}
                                </Text>
                            </View>
                        )}

                        {/* Title */}
                        <Text style={styles.showTitle} numberOfLines={2}>
                            {showName || showDetails.name}
                        </Text>

                        {/* Date */}
                        <Text style={styles.showDate}>
                            {getYear(showDetails.first_air_date)}
                        </Text>

                        {/* Badges */}
                        <View style={styles.badgesRow}>
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>{getContentRating()}</Text>
                            </View>
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>HD</Text>
                            </View>
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>4K</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Season Selector */}
                <TouchableOpacity
                    style={styles.seasonSelector}
                    onPress={() => setShowSeasonPicker(!showSeasonPicker)}
                >
                    <Text style={styles.seasonSelectorText}>
                        Season {selectedSeason}
                    </Text>
                    <ChevronDown color="#fff" size={20} />
                </TouchableOpacity>

                {/* Season Picker Dropdown */}
                {showSeasonPicker && showDetails.seasons && (
                    <View style={styles.seasonPickerDropdown}>
                        {showDetails.seasons
                            .filter(s => s.season_number > 0)
                            .map((season) => (
                                <TouchableOpacity
                                    key={season.id}
                                    style={[
                                        styles.seasonOption,
                                        selectedSeason === season.season_number && styles.seasonOptionActive
                                    ]}
                                    onPress={() => {
                                        setSelectedSeason(season.season_number);
                                        setShowSeasonPicker(false);
                                    }}
                                >
                                    <Text style={[
                                        styles.seasonOptionText,
                                        selectedSeason === season.season_number && styles.seasonOptionTextActive
                                    ]}>
                                        {season.name}
                                    </Text>
                                    <Text style={styles.episodeCount}>
                                        {season.episode_count} episodes
                                    </Text>
                                </TouchableOpacity>
                            ))
                        }
                    </View>
                )}

                {/* Episodes List */}
                {loading ? (
                    <View style={styles.episodesLoading}>
                        <ActivityIndicator size="small" color="#fff" />
                    </View>
                ) : (
                    <View style={styles.episodesList}>
                        {seasonDetails?.episodes.map((episode, index) => {
                            const fadeAnim = fadeAnims[index] || new Animated.Value(1);

                            return (
                                <Animated.View
                                    key={episode.id}
                                    style={[
                                        styles.episodeItem,
                                        {
                                            opacity: fadeAnim,
                                            transform: [{
                                                translateY: fadeAnim.interpolate({
                                                    inputRange: [0, 1],
                                                    outputRange: [15, 0],
                                                }),
                                            }],
                                        },
                                    ]}
                                >
                                    <TouchableOpacity
                                        style={styles.episodeTouchable}
                                        onPress={() => handleEpisodePress(episode)}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.episodeLeft}>
                                            <Text style={styles.episodeNumber}>
                                                Episode {episode.episode_number}
                                            </Text>
                                            <Text style={styles.episodeName} numberOfLines={1}>
                                                {episode.name}
                                            </Text>
                                        </View>
                                        <View style={styles.episodeRight}>
                                            <Text style={styles.episodeDuration}>
                                                {formatDuration(episode.runtime)}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                </Animated.View>
                            );
                        })}
                    </View>
                )}

                {/* Bottom Spacer */}
                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Torrent Results Modal */}
            {selectedEpisode && (
                <TorrentResultsModal
                    visible={showTorrentModal}
                    onClose={() => {
                        setShowTorrentModal(false);
                        setSelectedEpisode(null);
                    }}
                    episodeName={selectedEpisode.name}
                    episodeNumber={selectedEpisode.episode_number}
                    seasonNumber={selectedSeason}
                    showName={showName || showDetails.name}
                    tvId={tvId}
                    posterPath={posterPath || showDetails.poster_path}
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
    loadingContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    background: {
        ...StyleSheet.absoluteFillObject,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 20,
    },
    header: {
        paddingHorizontal: 20,
        paddingBottom: 20,
        alignItems: 'flex-start',
    },
    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    showInfoSection: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        marginBottom: 24,
    },
    posterContainer: {
        width: 120,
        height: 170,
        borderRadius: 12,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 10,
    },
    poster: {
        width: '100%',
        height: '100%',
    },
    detailsContainer: {
        flex: 1,
        marginLeft: 16,
        justifyContent: 'center',
    },
    networkBadge: {
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
        alignSelf: 'flex-start',
        marginBottom: 10,
    },
    networkText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '600',
    },
    showTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 6,
        fontFamily: Platform.OS === 'ios' ? 'San Francisco' : 'sans-serif',
    },
    showDate: {
        fontSize: 14,
        color: '#888',
        marginBottom: 12,
    },
    badgesRow: {
        flexDirection: 'row',
        gap: 8,
    },
    badge: {
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 4,
    },
    badgeText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '600',
    },
    seasonSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255,255,255,0.08)',
        marginHorizontal: 20,
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        marginBottom: 8,
    },
    seasonSelectorText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    seasonPickerDropdown: {
        backgroundColor: 'rgba(30,30,30,0.95)',
        marginHorizontal: 20,
        borderRadius: 12,
        marginBottom: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    seasonOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    seasonOptionActive: {
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    seasonOptionText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '500',
    },
    seasonOptionTextActive: {
        fontWeight: '700',
    },
    episodeCount: {
        color: '#666',
        fontSize: 13,
    },
    episodesLoading: {
        height: 100,
        justifyContent: 'center',
        alignItems: 'center',
    },
    episodesList: {
        paddingHorizontal: 20,
        marginTop: 8,
    },
    episodeItem: {
        marginBottom: 4,
    },
    episodeTouchable: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    episodeLeft: {
        flex: 1,
    },
    episodeNumber: {
        fontSize: 12,
        color: '#666',
        marginBottom: 4,
    },
    episodeName: {
        fontSize: 16,
        fontWeight: '500',
        color: '#fff',
    },
    episodeRight: {
        marginLeft: 16,
    },
    episodeDuration: {
        fontSize: 14,
        color: '#888',
    },
});
