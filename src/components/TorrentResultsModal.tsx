import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TouchableWithoutFeedback,
    Animated,
    Dimensions,
    ScrollView,
    ActivityIndicator,
    Platform,
    Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Play, Plus, Zap, HardDrive, AlertCircle, CheckCircle, ArrowUpDown, ArrowDown, ArrowUp } from 'lucide-react-native';
import { getTVCachedOnlyStreams, EnhancedStream, parseStreamInfo } from '../services/torrentio';
import { addTorrent, getInstantStreamUrl, getUserTorrents, TorBoxTorrent, getTorrentFilesWithUrls, getTorrentByHash } from '../services/torbox';
import { StorageService } from '../services/storage';
import { getTVExternalIds } from '../services/tmdb';
import { PlayerSelectionModal } from './PlayerSelectionModal';
import { isSeasonPack, isSeasonPackTitle } from '../services/episodeParser';
import { hasStreamAddons, getTVStreams as getAddonTVStreams } from '../services/stremioService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchZileanTVStreams } from '../services/zilean';
// Scrapers removed - xprime, scraperManager, types no longer imported


const { width, height } = Dimensions.get('window');

type QualityType = '4K' | '1080P' | 'EXTRA';
type SortOrderType = 'highToLow' | 'lowToHigh';

// Helper to parse size string to bytes for sorting
const parseSizeToBytes = (sizeStr: string): number => {
    if (!sizeStr || sizeStr === 'Unknown') return 0;
    const match = sizeStr.match(/(\d+\.?\d*)\s*(GB|MB|KB)?/i);
    if (!match) return 0;
    const value = parseFloat(match[1]);
    const unit = (match[2] || 'MB').toUpperCase();
    switch (unit) {
        case 'GB': return value * 1024 * 1024 * 1024;
        case 'MB': return value * 1024 * 1024;
        case 'KB': return value * 1024;
        default: return value * 1024 * 1024; // Default to MB
    }
};

interface TorrentResultsModalProps {
    visible: boolean;
    onClose: () => void;
    episodeName: string;
    episodeNumber: number;
    seasonNumber: number;
    showName: string;
    tvId: number;
    posterPath?: string | null;
    navigation: any;
}

// Status popup states
type PlayStatus = 'idle' | 'adding' | 'ready' | 'playing' | 'error';

export const TorrentResultsModal: React.FC<TorrentResultsModalProps> = ({
    visible,
    onClose,
    episodeName,
    episodeNumber,
    seasonNumber,
    showName,
    tvId,
    posterPath,
    navigation,
}) => {
    const scaleAnim = useRef(new Animated.Value(0.8)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const [selectedQuality, setSelectedQuality] = useState<QualityType>('1080P');
    const [sortOrder, setSortOrder] = useState<SortOrderType>('highToLow');
    const [loading, setLoading] = useState(false);
    const [allStreams, setAllStreams] = useState<EnhancedStream[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Play status popup state
    const [playStatus, setPlayStatus] = useState<PlayStatus>('idle');
    const [statusMessage, setStatusMessage] = useState('');
    const [currentStreamUrl, setCurrentStreamUrl] = useState<string | null>(null);

    // Track which torrents are added to library and their stream URLs
    const [addedToLibrary, setAddedToLibrary] = useState<Map<string, string>>(new Map()); // hash -> streamUrl
    const [addingToLibrary, setAddingToLibrary] = useState<Set<string>>(new Set());

    // Track torrents that already exist in user's TorBox library
    const [libraryHashes, setLibraryHashes] = useState<Map<string, TorBoxTorrent>>(new Map());

    // Player selection modal state
    const [showPlayerSelection, setShowPlayerSelection] = useState(false);
    const [selectedStreamUrl, setSelectedStreamUrl] = useState<string | null>(null);
    const [selectedStreamHash, setSelectedStreamHash] = useState<string | null>(null);

    // Addon state - track if multi-source mode is enabled
    const [addonsEnabled, setAddonsEnabled] = useState(false);
    const [enabledAddonNames, setEnabledAddonNames] = useState<string[]>([]);
    // Track if Zilean indexer is active (for Extra tab and no-limit behavior)
    const [isZileanIndexer, setIsZileanIndexer] = useState(false);
    const [selectedAddon, setSelectedAddon] = useState<string | null>(null); // null = all, string = specific addon

    // Scrapers removed - always use TorBox mode
    const useTorBox = true;

    useEffect(() => {
        if (visible) {
            loadUserLibrary(); // Load library to check for existing torrents
            fetchCachedStreams();
            animateIn();
        } else {
            resetState();
        }
    }, [visible]);

    const animateIn = () => {
        Animated.parallel([
            Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 8,
                tension: 65,
                useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start();
    };

    const resetState = () => {
        scaleAnim.setValue(0.8);
        opacityAnim.setValue(0);
        setAllStreams([]);
        setError(null);
        setPlayStatus('idle');
        setStatusMessage('');
        setCurrentStreamUrl(null);
        setAddedToLibrary(new Map());
        setAddingToLibrary(new Set());
        setLibraryHashes(new Map());
        setShowPlayerSelection(false);
        setSelectedStreamUrl(null);
        setSelectedStreamHash(null);
        setAddonsEnabled(false);
        setEnabledAddonNames([]);
        setSelectedAddon(null);
    };

    // Load user's TorBox library
    const loadUserLibrary = async () => {
        try {
            // Scrapers removed - always use TorBox
            const torrents = await getUserTorrents();
            const hashMap = new Map<string, TorBoxTorrent>();
            torrents.forEach(torrent => {
                hashMap.set(torrent.hash.toLowerCase(), torrent);
            });
            setLibraryHashes(hashMap);
            console.log('Loaded', hashMap.size, 'torrents from user library');
        } catch (error) {
            console.error('Error loading user library:', error);
        }
    };

    const fetchCachedStreams = async () => {
        setLoading(true);
        setError(null);

        try {
            console.log('=== fetchCachedStreams START ===');
            console.log('tvId:', tvId, 'Season:', seasonNumber, 'Episode:', episodeNumber);

            // Scrapers removed - TorBox only mode
            console.log('Using TorBox mode (scrapers removed)');

            // TorBox MODE - fetch from TorBox only
            const torboxApiKey = await StorageService.getTorBoxApiKey();
            console.log('TorBox API Key:', torboxApiKey ? 'Found' : 'NOT FOUND');

            // Check if addons multi-source mode is enabled FIRST
            const addonsMasterEnabled = await AsyncStorage.getItem('@streamed_addons_enabled');
            const isAddonsEnabled = addonsMasterEnabled === 'true';
            setAddonsEnabled(isAddonsEnabled);

            // Addons mode can work without Torbox API key (for direct URL streams)
            // Only require Torbox key if NOT using addons mode
            if (!torboxApiKey && !isAddonsEnabled) {
                setError('TorBox API key not configured. You can also enable Addons mode in Settings → Addons for free streaming.');
                setLoading(false);
                return;
            }

            console.log('Fetching external IDs...');
            const externalIds = await getTVExternalIds(tvId);
            console.log('External IDs:', JSON.stringify(externalIds));

            if (!externalIds.imdb_id) {
                setError('Could not find IMDB ID for this show');
                setLoading(false);
                return;
            }

            // Get active indexer
            const activeIndexer = await StorageService.getActiveIndexer();
            console.log('Active indexer:', activeIndexer);

            let streams: EnhancedStream[] = [];

            // PRIORITY 1: ADDONS MODE takes priority over any indexer
            // If addons are enabled and installed, use them regardless of Zilean/Torrentio selection
            if (isAddonsEnabled) {
                const hasAddons = await hasStreamAddons();
                if (!hasAddons) {
                    setError('No stream addons installed. Go to Settings → Addons to add Torrentio, Comet, or similar.');
                    setLoading(false);
                    return;
                }
                setIsZileanIndexer(false); // Not using Zilean when in addons mode
                console.log('Using addon system for TV (addons mode enabled)...');
                // Fetch from installed addons (stremioService)
                const addonStreams = await getAddonTVStreams(externalIds.imdb_id, seasonNumber, episodeNumber);
                // Convert to EnhancedStream format
                streams = addonStreams.map(s => ({
                    name: s.name || 'Stream',
                    title: s.title || s.name || '',
                    infoHash: s.infoHash,
                    url: s.url,
                    quality: '1080p',
                    source: s.addonName || 'Addon',
                    size: s.behaviorHints?.videoSize ? `${(s.behaviorHints.videoSize / (1024 * 1024 * 1024)).toFixed(1)} GB` : 'Unknown',
                    description: s.title || s.description || '',
                    addonId: s.addonId,
                    addonName: s.addonName,
                    isCached: s.isCached || s.isDirectUrl,
                    behaviorHints: s.behaviorHints
                })) as EnhancedStream[];
            }
            // PRIORITY 2: INDEXER MODE (no addons enabled) - requires Torbox API key
            else if (activeIndexer === 'zilean') {
                // Zilean indexer - requires Torbox key for cache checking
                if (!torboxApiKey) {
                    setError('TorBox API key required for Zilean indexer. Go to Profile to add it.');
                    setLoading(false);
                    return;
                }
                setIsZileanIndexer(true);
                console.log('Using Zilean indexer for TV (unlimited results)...');
                try {
                    streams = await fetchZileanTVStreams(externalIds.imdb_id, seasonNumber, episodeNumber, torboxApiKey, true);
                    console.log('Zilean TorBox-cached streams found:', streams.length);
                } catch (zileanErr: any) {
                    console.error('Zilean fetch failed:', zileanErr.message);
                    setError('Failed to fetch from Zilean');
                }
            } else {
                // Torrentio indexer - requires Torbox key
                if (!torboxApiKey) {
                    setError('TorBox API key required for Torrentio indexer. Go to Profile to add it.');
                    setLoading(false);
                    return;
                }
                setIsZileanIndexer(false);
                console.log('Using Torrentio for TV (single source)...');
                streams = await getTVCachedOnlyStreams(
                    externalIds.imdb_id,
                    seasonNumber,
                    episodeNumber,
                    torboxApiKey
                );
            }

            // Extract unique addon names from streams
            const addonNames = [...new Set(streams.map((s: any) => s.addonName || (activeIndexer === 'zilean' ? 'Zilean' : 'Torrentio')))];
            setEnabledAddonNames(addonNames);
            console.log('Addon names from streams:', addonNames);

            console.log('Total streams returned:', streams.length);
            setAllStreams(streams);

            if (streams.length === 0) {
                setError(activeIndexer === 'zilean'
                    ? 'No TorBox-cached torrents found in Zilean for this episode'
                    : 'No cached torrents found for this episode');
            }
        } catch (err: any) {
            console.error('Error fetching streams:', err?.message || err);
            setError('Failed to fetch streams: ' + (err?.message || 'Unknown error'));
        } finally {
            setLoading(false);
            console.log('=== fetchCachedStreams END ===');
        }
    };

    const handleClose = () => {
        if (playStatus !== 'idle') {
            setPlayStatus('idle');
            return;
        }

        Animated.parallel([
            Animated.timing(scaleAnim, {
                toValue: 0.8,
                duration: 150,
                useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
            }),
        ]).start(() => onClose());
    };

    // Handle adding torrent to library (Plus button clicked)
    const handleAddToLibrary = async (stream: EnhancedStream) => {
        console.log('=== ADD TO LIBRARY CLICKED ===');
        console.log('Stream data:', JSON.stringify(stream, null, 2).substring(0, 500));

        if (!stream.infoHash) {
            console.error('No infoHash in stream!');
            Alert.alert('Error', 'Cannot add this torrent - missing hash');
            return;
        }

        const hash = stream.infoHash.toLowerCase();
        console.log('Hash:', hash);

        // Mark as adding
        setAddingToLibrary(prev => new Set(prev).add(hash));

        try {
            // Add to TorBox library
            console.log('Calling addTorrent...');
            const torrent = await addTorrent(stream.infoHash);
            console.log('addTorrent result:', torrent);

            if (!torrent) {
                Alert.alert('Error', 'Failed to add torrent to library');
                return;
            }

            // Save bookmark for this TV show (for Downloads feature)
            try {
                await StorageService.addDownloadBookmark('tv', tvId, {
                    torrentId: torrent.id,
                    torrentHash: stream.infoHash,
                    torrentName: torrent.name || stream.title || 'Unknown',
                    size: torrent.size || 0,
                    quality: stream.name?.match(/(4K|2160p|1080p|720p|480p)/i)?.[0] || undefined,
                    addedAt: Date.now(),
                    seasonNumber: seasonNumber,
                    episodeNumber: episodeNumber,
                });
                console.log('Saved download bookmark for TV:', tvId, 'S' + seasonNumber + 'E' + episodeNumber);
            } catch (bookmarkErr) {
                console.error('Failed to save bookmark:', bookmarkErr);
                // Don't fail the whole operation if bookmark fails
            }

            // Get stream URL
            console.log('Getting stream URL...');
            const streamUrl = await getInstantStreamUrl(stream.infoHash, stream.fileIdx);
            console.log('Stream URL:', streamUrl ? 'Got URL' : 'No URL returned');

            if (streamUrl) {
                // Mark as added with stream URL
                setAddedToLibrary(prev => new Map(prev).set(hash, streamUrl));
                console.log('Successfully added to library with stream URL');
            } else {
                // Added but no URL yet - still mark as added
                setAddedToLibrary(prev => new Map(prev).set(hash, ''));
                console.log('Added to library but no stream URL yet');
            }
        } catch (err: any) {
            console.error('Error adding to library:', err);
            Alert.alert('Error', err.message || 'Failed to add torrent');
        } finally {
            // Remove from adding state
            setAddingToLibrary(prev => {
                const next = new Set(prev);
                next.delete(hash);
                return next;
            });
        }
    };

    // Handle watching (Play button clicked after added to library)
    const handleWatchTorrent = async (stream: EnhancedStream) => {
        if (!stream.infoHash) return;

        const hash = stream.infoHash.toLowerCase();
        const cachedUrl = addedToLibrary.get(hash);

        if (cachedUrl) {
            // Use cached stream URL - show player selection
            setSelectedStreamUrl(cachedUrl);
            setSelectedStreamHash(stream.infoHash);
            setShowPlayerSelection(true);
        } else {
            // Need to fetch stream URL first
            try {
                setPlayStatus('adding');
                setStatusMessage('Getting stream URL...');

                const streamUrl = await getInstantStreamUrl(stream.infoHash, stream.fileIdx);

                if (streamUrl) {
                    setPlayStatus('idle');
                    // Show player selection modal
                    setSelectedStreamUrl(streamUrl);
                    setSelectedStreamHash(stream.infoHash);
                    setShowPlayerSelection(true);
                } else {
                    setPlayStatus('error');
                    setStatusMessage('Could not get stream URL. Try again.');
                }
            } catch (err) {
                setPlayStatus('error');
                setStatusMessage('Failed to get stream. Check your API key.');
            }
        }
    };

    // Handle direct URL streams (MediaFusion/Comet with debrid - no TorBox needed)
    const handlePlayDirectUrl = (stream: EnhancedStream) => {
        if (!stream.url) {
            setPlayStatus('error');
            setStatusMessage('No stream URL available');
            return;
        }

        // Direct URL streams can play immediately - show player selection
        setSelectedStreamUrl(stream.url);
        setSelectedStreamHash(null);  // No hash for direct URLs
        setShowPlayerSelection(true);
    };

    // Handle internal player selection
    const handleSelectInternalPlayer = async () => {
        if (!selectedStreamUrl) return;

        // Direct URL streams (no hash) - play immediately
        if (!selectedStreamHash) {
            onClose();
            navigation.navigate('VideoPlayer', {
                title: `${showName} - S${seasonNumber}E${episodeNumber}`,
                videoUrl: selectedStreamUrl,
                posterUrl: posterPath,
                tmdbId: tvId,
                mediaType: 'tv',
                seasonNumber,
                episodeNumber,
                episodeName,
                provider: 'debrid',  // Mark as debrid source for watch history
            });
            return;
        }

        try {
            // Check if this is a multi-file torrent (season pack)
            const torrent = await getTorrentByHash(selectedStreamHash);

            if (torrent && torrent.files && torrent.files.length > 1) {
                // This is a season pack or multi-file torrent
                // Fetch all files with their stream URLs
                const filesWithUrls = await getTorrentFilesWithUrls(torrent.id);

                if (filesWithUrls.length > 1) {
                    // Alert user about multiple files
                    Alert.alert(
                        'Season Pack Detected',
                        `This torrent contains ${filesWithUrls.length} video files. You can select episodes from the player.`,
                        [
                            {
                                text: 'Continue',
                                onPress: () => {
                                    onClose();
                                    navigation.navigate('VideoPlayer', {
                                        title: `${showName} - S${seasonNumber}E${episodeNumber}`,
                                        videoUrl: filesWithUrls[0]?.streamUrl || selectedStreamUrl,
                                        posterUrl: posterPath,
                                        tmdbId: tvId,
                                        mediaType: 'tv',
                                        seasonNumber,
                                        episodeNumber,
                                        episodeName,
                                        torrentHash: selectedStreamHash,
                                        files: filesWithUrls,
                                        currentFileIndex: 0,
                                        provider: 'torbox',  // Mark as TorBox source for watch history
                                    });
                                },
                            },
                        ]
                    );
                    return;
                }
            }

            // Single file torrent - navigate directly
            onClose();
            navigation.navigate('VideoPlayer', {
                title: `${showName} - S${seasonNumber}E${episodeNumber}`,
                videoUrl: selectedStreamUrl,
                posterUrl: posterPath,
                tmdbId: tvId,
                mediaType: 'tv',
                seasonNumber,
                episodeNumber,
                episodeName,
                torrentHash: selectedStreamHash,
                provider: 'torbox',  // Mark as TorBox source for watch history
            });
        } catch (error) {
            console.error('Error preparing playback:', error);
            // Fallback to direct navigation
            onClose();
            navigation.navigate('VideoPlayer', {
                title: `${showName} - S${seasonNumber}E${episodeNumber}`,
                videoUrl: selectedStreamUrl,
                posterUrl: posterPath,
                tmdbId: tvId,
                mediaType: 'tv',
                seasonNumber,
                episodeNumber,
                episodeName,
                torrentHash: selectedStreamHash,
                provider: 'torbox',  // Mark as TorBox source for watch history
            });
        }
    };

    const handlePlayTorrent = async (stream: EnhancedStream) => {
        if (!stream.infoHash) {
            setPlayStatus('error');
            setStatusMessage('No torrent hash available');
            return;
        }

        try {
            // Step 1: Show adding to library popup
            setPlayStatus('adding');
            setStatusMessage('Adding to your TorBox library...');

            // Add to TorBox library
            await addTorrent(stream.infoHash);

            // Step 2: Show ready status
            setPlayStatus('ready');
            setStatusMessage('Added! Getting stream URL...');

            // Get stream URL
            const streamUrl = await getInstantStreamUrl(stream.infoHash, stream.fileIdx);

            if (streamUrl) {
                setCurrentStreamUrl(streamUrl);
                setPlayStatus('playing');
                setStatusMessage('Ready to play!');

                // Auto-navigate after a short delay
                setTimeout(() => {
                    onClose();
                    navigation.navigate('VideoPlayer', {
                        title: `${showName} - S${seasonNumber}E${episodeNumber}`,
                        videoUrl: streamUrl,
                        posterUrl: posterPath,
                        tmdbId: tvId,
                        mediaType: 'tv',
                        seasonNumber,
                        episodeNumber,
                        episodeName,
                        torrentHash: stream.infoHash,  // Pass hash for resume from Continue Watching
                        provider: 'torbox',  // Mark as TorBox source for watch history
                    });
                }, 500);
            } else {
                setPlayStatus('error');
                setStatusMessage('Could not get stream URL. Try again.');
            }
        } catch (err) {
            console.error('Error playing torrent:', err);
            setPlayStatus('error');
            setStatusMessage('Failed to add. Check your API key.');
        }
    };

    const handlePlayNow = () => {
        if (currentStreamUrl) {
            onClose();
            navigation.navigate('VideoPlayer', {
                title: `${showName} - S${seasonNumber}E${episodeNumber}`,
                videoUrl: currentStreamUrl,
                posterUrl: posterPath,
                tmdbId: tvId,
                mediaType: 'tv',
                seasonNumber,
                episodeNumber,
                episodeName,
            });
        }
    };

    // Filter by quality, sort by size, and EXCLUDE season packs (single episodes only)
    const getStreamsForQuality = (quality: QualityType): EnhancedStream[] => {
        let filtered: EnhancedStream[];

        if (quality === 'EXTRA') {
            // Extra: NOT 4K and NOT 1080P (720p, 480p, etc.), excluding season packs
            filtered = allStreams.filter(stream => {
                if (isSeasonPackTitle(stream.title)) return false;
                const info = parseStreamInfo(stream);
                const is4K = info.quality === '2160P' || info.quality === '4K';
                const is1080P = info.quality === '1080P';
                return !is4K && !is1080P;
            });
        } else if (quality === '4K') {
            filtered = allStreams.filter(stream => {
                if (isSeasonPackTitle(stream.title)) return false;
                const info = parseStreamInfo(stream);
                return info.quality === '2160P' || info.quality === '4K';
            });
        } else {
            // 1080P
            filtered = allStreams.filter(stream => {
                if (isSeasonPackTitle(stream.title)) return false;
                const info = parseStreamInfo(stream);
                return info.quality === '1080P';
            });
        }

        // Filter by selected addon if one is selected
        const addonFiltered = selectedAddon
            ? filtered.filter((s: any) => (s.addonName || 'Torrentio') === selectedAddon)
            : filtered;

        // Sort by size
        const sorted = [...addonFiltered].sort((a, b) => {
            const sizeA = parseSizeToBytes(parseStreamInfo(a).size);
            const sizeB = parseSizeToBytes(parseStreamInfo(b).size);
            return sortOrder === 'highToLow' ? sizeB - sizeA : sizeA - sizeB;
        });

        // ZILEAN: No limit for all qualities
        // OTHERS: 10 limit for legacy mode, no limit for addon mode
        if (isZileanIndexer) {
            return sorted; // No limit for Zilean
        } else {
            return addonsEnabled ? sorted : sorted.slice(0, 10);
        }
    };

    // Get season pack streams (full seasons, complete series, etc.)
    const getSeasonPackStreams = (): EnhancedStream[] => {
        const filtered = allStreams.filter(stream => isSeasonPackTitle(stream.title));

        // Sort by size (high to low by default for season packs)
        const sorted = [...filtered].sort((a, b) => {
            const sizeA = parseSizeToBytes(parseStreamInfo(a).size);
            const sizeB = parseSizeToBytes(parseStreamInfo(b).size);
            return sizeB - sizeA; // Always high to low for season packs
        });

        // ZILEAN: No limit for season packs
        // OTHERS: 10 limit for legacy mode, no limit for addon mode
        if (isZileanIndexer) {
            return sorted; // No limit for Zilean
        } else {
            return addonsEnabled ? sorted : sorted.slice(0, 10);
        }
    };

    const streams4K = getStreamsForQuality('4K');
    const streams1080P = getStreamsForQuality('1080P');
    const streamsExtra = isZileanIndexer ? getStreamsForQuality('EXTRA') : [];
    const seasonPackStreams = getSeasonPackStreams();
    const currentStreams = selectedQuality === '4K' ? streams4K :
        selectedQuality === '1080P' ? streams1080P : streamsExtra;

    // Get stream counts per addon for the filter buttons
    const getAddonStreamCounts = (): Map<string, number> => {
        const counts = new Map<string, number>();
        const qualityStreams = allStreams.filter(stream => {
            // Exclude season packs
            if (isSeasonPackTitle(stream.title)) return false;
            const info = parseStreamInfo(stream);
            if (selectedQuality === '4K') {
                return info.quality === '2160P' || info.quality === '4K';
            } else if (selectedQuality === 'EXTRA') {
                const is4K = info.quality === '2160P' || info.quality === '4K';
                const is1080P = info.quality === '1080P';
                return !is4K && !is1080P;
            }
            return info.quality === '1080P';
        });

        for (const stream of qualityStreams) {
            const addonName = (stream as any).addonName || 'Torrentio';
            counts.set(addonName, (counts.get(addonName) || 0) + 1);
        }
        return counts;
    };

    const addonCounts = getAddonStreamCounts();

    // Group current streams by addon name
    const groupStreamsByAddonFiltered = (streams: EnhancedStream[]): Map<string, EnhancedStream[]> => {
        const grouped = new Map<string, EnhancedStream[]>();

        for (const stream of streams) {
            // Get addon name from stream (added by stremioAddons.ts)
            const addonName = (stream as any).addonName || 'Torrentio';
            if (!grouped.has(addonName)) {
                grouped.set(addonName, []);
            }
            grouped.get(addonName)!.push(stream);
        }

        return grouped;
    };

    const groupedStreams = groupStreamsByAddonFiltered(currentStreams);

    const renderTorrentItem = (stream: EnhancedStream, index: number) => {
        const hashKey = stream.infoHash?.toLowerCase() || `direct-${index}`;
        const info = parseStreamInfo(stream);

        // Check if this is a direct URL stream (MediaFusion/Comet with debrid)
        const isDirectStream = stream.isDirectUrl || (stream.url && !stream.infoHash);

        const isAdding = addingToLibrary.has(hashKey);
        // Check both newly added AND existing library items
        const isInLibrary = libraryHashes.has(hashKey);
        const isAdded = addedToLibrary.has(hashKey) || isInLibrary;

        // Determine which button action to use
        const handleButtonPress = () => {
            if (isDirectStream) {
                // Direct URL - play immediately
                handlePlayDirectUrl(stream);
            } else if (isAdded) {
                handleWatchTorrent(stream);
            } else if (!isAdding) {
                handleAddToLibrary(stream);
            }
        };

        return (
            <View
                key={hashKey}
                style={styles.torrentItem}
            >
                <View style={styles.torrentLeft}>
                    {/* Top row: Quality badge + Cached/Debrid status + Addon name */}
                    <View style={styles.torrentHeader}>
                        <View style={styles.qualityBadge}>
                            <Text style={styles.qualityText}>{info.quality}</Text>
                        </View>
                        {/* Stream type badge: Debrid (direct URL) / Cached (in library) / Torrent (P2P) */}
                        {isDirectStream ? (
                            <View style={[styles.cachedBadge, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
                                <Zap color="#A855F7" size={10} />
                                <Text style={[styles.cachedText, { color: '#A855F7' }]}>Debrid</Text>
                            </View>
                        ) : isAdded ? (
                            <View style={styles.cachedBadge}>
                                <Zap color="#10B981" size={10} />
                                <Text style={styles.cachedText}>Cached</Text>
                            </View>
                        ) : (
                            <View style={[styles.cachedBadge, { backgroundColor: 'rgba(234, 179, 8, 0.15)' }]}>
                                <Zap color="#EAB308" size={10} />
                                <Text style={[styles.cachedText, { color: '#EAB308' }]}>Torrent</Text>
                            </View>
                        )}
                        <Text style={styles.addonBadge}>{(stream as any).addonName || 'Torrentio'}</Text>
                    </View>

                    {/* Release name */}
                    <Text style={styles.torrentName} numberOfLines={1}>
                        {info.fullTitle}
                    </Text>

                    {/* Technical specs row: codec • HDR • audio */}
                    <View style={styles.specsRow}>
                        {info.codec && (
                            <Text style={styles.specBadge}>{info.codec}</Text>
                        )}
                        {info.hdr && (
                            <Text style={[styles.specBadge, styles.hdrBadge]}>{info.hdr}</Text>
                        )}
                        {info.audio && (
                            <Text style={[styles.specBadge, styles.audioBadge]}>🔊 {info.audio}</Text>
                        )}
                    </View>

                    {/* Bottom row: source type • size • seeds • languages */}
                    <View style={styles.metaRow}>
                        {info.sourceType && (
                            <Text style={styles.sourceType}>★ {info.sourceType}</Text>
                        )}
                        {info.size !== 'Unknown' && (
                            <Text style={styles.sizeText}>📦 {info.size}</Text>
                        )}
                        {info.seeders !== '0' && (
                            <Text style={styles.seedsText}>🌱 {info.seeders}</Text>
                        )}
                        {info.languages.length > 0 && (
                            <Text style={styles.langText}>{info.languages.join('/')}</Text>
                        )}
                    </View>
                </View>

                <TouchableOpacity
                    style={[
                        styles.actionButton,
                        (isAdded || isDirectStream) && styles.watchButton,
                        isAdding && styles.loadingButton,
                    ]}
                    onPress={handleButtonPress}
                    activeOpacity={0.7}
                    disabled={isAdding}
                >
                    {isAdding ? (
                        <ActivityIndicator color="#fff" size="small" />
                    ) : (isAdded || isDirectStream) ? (
                        <Play color="#fff" size={18} fill="#fff" />
                    ) : (
                        <Plus color="#fff" size={20} strokeWidth={2.5} />
                    )}
                </TouchableOpacity>
            </View>
        );
    };

    // Render status popup
    const renderStatusPopup = () => {
        if (playStatus === 'idle') return null;

        return (
            <View style={styles.statusOverlay}>
                <View style={styles.statusPopup}>
                    {playStatus === 'adding' && (
                        <>
                            <ActivityIndicator size="large" color="#10B981" />
                            <Text style={styles.statusText}>{statusMessage}</Text>
                        </>
                    )}

                    {playStatus === 'ready' && (
                        <>
                            <ActivityIndicator size="large" color="#10B981" />
                            <Text style={styles.statusText}>{statusMessage}</Text>
                        </>
                    )}

                    {playStatus === 'playing' && (
                        <>
                            <View style={styles.successIcon}>
                                <CheckCircle color="#10B981" size={48} />
                            </View>
                            <Text style={styles.statusText}>{statusMessage}</Text>
                            <TouchableOpacity
                                style={styles.playNowButton}
                                onPress={handlePlayNow}
                            >
                                <Play color="#fff" size={20} fill="#fff" />
                                <Text style={styles.playNowText}>Play Now</Text>
                            </TouchableOpacity>
                        </>
                    )}

                    {playStatus === 'error' && (
                        <>
                            <AlertCircle color="#EF4444" size={48} />
                            <Text style={styles.statusTextError}>{statusMessage}</Text>
                            <TouchableOpacity
                                style={styles.dismissButton}
                                onPress={() => setPlayStatus('idle')}
                            >
                                <Text style={styles.dismissText}>Dismiss</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </View>
        );
    };

    return (
        <>
            <Modal
                visible={visible}
                transparent
                animationType="none"
                statusBarTranslucent
                onRequestClose={handleClose}
            >
                <TouchableWithoutFeedback onPress={handleClose}>
                    <View style={styles.overlay}>
                        <TouchableWithoutFeedback>
                            <Animated.View
                                style={[
                                    styles.modalContainer,
                                    {
                                        opacity: opacityAnim,
                                        transform: [{ scale: scaleAnim }],
                                    },
                                ]}
                            >
                                <BlurView intensity={80} tint="dark" style={styles.blurContainer}>
                                    <LinearGradient
                                        colors={['rgba(40,40,40,0.9)', 'rgba(20,20,20,0.95)']}
                                        style={styles.gradientOverlay}
                                    >
                                        {/* Header */}
                                        <View style={styles.header}>
                                            <View style={styles.headerLeft}>
                                                <Text style={styles.episodeLabel}>
                                                    S{seasonNumber} E{episodeNumber}
                                                </Text>
                                                <Text style={styles.episodeName} numberOfLines={1}>
                                                    {episodeName}
                                                </Text>
                                            </View>
                                            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                                                <X color="#fff" size={20} />
                                            </TouchableOpacity>
                                        </View>

                                        {/* Source Banner */}
                                        <View style={[styles.cachedBanner, !useTorBox && { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                                            <Zap color={useTorBox ? '#10B981' : '#3B82F6'} size={16} />
                                            <Text style={[styles.cachedBannerText, !useTorBox && { color: '#3B82F6' }]}>
                                                {useTorBox
                                                    ? 'TorBox Cached • Instant playback'
                                                    : 'Free Scrapers • No account needed'}
                                            </Text>
                                        </View>

                                        {/* Quality Tabs - Only for TorBox */}
                                        {useTorBox && (
                                            <View style={styles.qualityTabs}>
                                                <TouchableOpacity
                                                    style={[
                                                        styles.qualityTab,
                                                        selectedQuality === '4K' && styles.qualityTabActive,
                                                    ]}
                                                    onPress={() => setSelectedQuality('4K')}
                                                >
                                                    <Text style={[
                                                        styles.qualityTabText,
                                                        selectedQuality === '4K' && styles.qualityTabTextActive,
                                                    ]}>
                                                        4K UHD ({streams4K.length})
                                                    </Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[
                                                        styles.qualityTab,
                                                        selectedQuality === '1080P' && styles.qualityTabActive,
                                                    ]}
                                                    onPress={() => setSelectedQuality('1080P')}
                                                >
                                                    <Text style={[
                                                        styles.qualityTabText,
                                                        selectedQuality === '1080P' && styles.qualityTabTextActive,
                                                    ]}>
                                                        1080P HD ({streams1080P.length})
                                                    </Text>
                                                </TouchableOpacity>
                                                {/* Extra tab - Only for Zilean when there are non-4K/1080P streams */}
                                                {isZileanIndexer && streamsExtra.length > 0 && (
                                                    <TouchableOpacity
                                                        style={[
                                                            styles.qualityTab,
                                                            selectedQuality === 'EXTRA' && styles.qualityTabActive,
                                                        ]}
                                                        onPress={() => setSelectedQuality('EXTRA')}
                                                    >
                                                        <Text style={[
                                                            styles.qualityTabText,
                                                            selectedQuality === 'EXTRA' && styles.qualityTabTextActive,
                                                        ]}>
                                                            Extra ({streamsExtra.length})
                                                        </Text>
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        )}

                                        {/* Addon Filter Tabs - Only when addons are enabled and have multiple sources */}
                                        {addonsEnabled && enabledAddonNames.length > 0 && (
                                            <ScrollView
                                                horizontal
                                                showsHorizontalScrollIndicator={false}
                                                style={styles.addonFilterRow}
                                                contentContainerStyle={styles.addonFilterContent}
                                            >
                                                {/* Individual addon buttons */}
                                                {enabledAddonNames.map(addonName => {
                                                    const count = addonCounts.get(addonName) || 0;
                                                    return (
                                                        <TouchableOpacity
                                                            key={addonName}
                                                            style={[
                                                                styles.addonFilterTab,
                                                                selectedAddon === addonName && styles.addonFilterTabActive,
                                                            ]}
                                                            onPress={() => setSelectedAddon(selectedAddon === addonName ? null : addonName)}
                                                        >
                                                            <Text style={[
                                                                styles.addonFilterText,
                                                                selectedAddon === addonName && styles.addonFilterTextActive,
                                                            ]}>
                                                                {addonName} ({count})
                                                            </Text>
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                            </ScrollView>
                                        )}

                                        {/* Size Sort Buttons - Only for TorBox */}
                                        {useTorBox && (
                                            <View style={styles.sortRow}>
                                                <Text style={styles.sortLabel}>Size:</Text>
                                                <TouchableOpacity
                                                    style={[
                                                        styles.sortButton,
                                                        sortOrder === 'highToLow' && styles.sortButtonActive,
                                                    ]}
                                                    onPress={() => setSortOrder('highToLow')}
                                                >
                                                    <ArrowDown
                                                        color={sortOrder === 'highToLow' ? '#000' : '#888'}
                                                        size={14}
                                                    />
                                                    <Text style={[
                                                        styles.sortButtonText,
                                                        sortOrder === 'highToLow' && styles.sortButtonTextActive,
                                                    ]}>High → Low</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[
                                                        styles.sortButton,
                                                        sortOrder === 'lowToHigh' && styles.sortButtonActive,
                                                    ]}
                                                    onPress={() => setSortOrder('lowToHigh')}
                                                >
                                                    <ArrowUp
                                                        color={sortOrder === 'lowToHigh' ? '#000' : '#888'}
                                                        size={14}
                                                    />
                                                    <Text style={[
                                                        styles.sortButtonText,
                                                        sortOrder === 'lowToHigh' && styles.sortButtonTextActive,
                                                    ]}>Low → High</Text>
                                                </TouchableOpacity>
                                            </View>
                                        )}

                                        {/* Content */}
                                        {loading ? (
                                            <View style={styles.loadingContainer}>
                                                <ActivityIndicator size="large" color="#fff" />
                                                <Text style={styles.loadingText}>
                                                    Finding streams...
                                                </Text>
                                            </View>
                                        ) : error ? (
                                            <View style={styles.errorContainer}>
                                                <AlertCircle color="#EF4444" size={32} />
                                                <Text style={styles.errorText}>{error}</Text>
                                            </View>
                                        ) : (
                                            /* TorBox Mode - Show Torrents */
                                            <ScrollView
                                                style={styles.torrentList}
                                                showsVerticalScrollIndicator={true}
                                                contentContainerStyle={styles.torrentListContent}
                                                nestedScrollEnabled={true}
                                            >
                                                {/* Flat list of streams (filtering done by addon tabs) */}
                                                {currentStreams.map((stream, i) =>
                                                    renderTorrentItem(stream, i)
                                                )}

                                                {currentStreams.length === 0 && (
                                                    <View style={styles.emptyContainer}>
                                                        <HardDrive color="#666" size={32} />
                                                        <Text style={styles.emptyText}>
                                                            No {selectedQuality} torrents {selectedAddon ? `from ${selectedAddon}` : 'cached'}
                                                        </Text>
                                                    </View>
                                                )}

                                                {/* Season Packs Section */}
                                                {seasonPackStreams.length > 0 && (
                                                    <View style={styles.seasonPackSection}>
                                                        <View style={styles.seasonPackHeader}>
                                                            <Text style={styles.seasonPackTitle}>
                                                                📦 Season Packs ({seasonPackStreams.length})
                                                            </Text>
                                                            <Text style={styles.seasonPackSubtitle}>
                                                                Add to library for episode selection
                                                            </Text>
                                                        </View>
                                                        {seasonPackStreams.map((stream, i) => {
                                                            const info = parseStreamInfo(stream);
                                                            const hash = stream.infoHash?.toLowerCase() || '';
                                                            const isInLibrary = libraryHashes.has(hash) || addedToLibrary.has(hash);
                                                            const isAdding = addingToLibrary.has(hash);

                                                            return (
                                                                <View key={`sp-${i}`} style={styles.seasonPackItem}>
                                                                    <View style={styles.torrentLeft}>
                                                                        <View style={styles.qualityRow}>
                                                                            <Text style={styles.qualityBadge}>{info.quality}</Text>
                                                                            <View style={styles.cachedBadge}>
                                                                                <Zap color="#10B981" size={10} />
                                                                                <Text style={styles.cachedText}>Cached</Text>
                                                                            </View>
                                                                        </View>
                                                                        <Text style={styles.torrentName} numberOfLines={2}>
                                                                            {info.source} • {info.size}
                                                                        </Text>
                                                                    </View>

                                                                    <TouchableOpacity
                                                                        style={[
                                                                            styles.actionButton,
                                                                            isInLibrary && styles.inLibraryButton,
                                                                            isAdding && styles.loadingButton,
                                                                        ]}
                                                                        onPress={() => !isInLibrary && handleAddToLibrary(stream)}
                                                                        activeOpacity={0.7}
                                                                        disabled={isAdding || isInLibrary}
                                                                    >
                                                                        {isAdding ? (
                                                                            <ActivityIndicator color="#fff" size="small" />
                                                                        ) : isInLibrary ? (
                                                                            <CheckCircle color="#10B981" size={18} />
                                                                        ) : (
                                                                            <Plus color="#fff" size={20} strokeWidth={2.5} />
                                                                        )}
                                                                    </TouchableOpacity>
                                                                </View>
                                                            );
                                                        })}
                                                    </View>
                                                )}
                                            </ScrollView>
                                        )}

                                        {/* Status Popup Overlay */}
                                        {renderStatusPopup()}
                                    </LinearGradient>
                                </BlurView>
                            </Animated.View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>

            {/* Player Selection Modal */}
            <PlayerSelectionModal
                visible={showPlayerSelection}
                onClose={() => setShowPlayerSelection(false)}
                onSelectInternal={handleSelectInternalPlayer}
                streamUrl={selectedStreamUrl || ''}
                title={`${showName} - S${seasonNumber}E${episodeNumber}`}
            />
        </>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        maxHeight: height * 0.75,
        marginHorizontal: 12,
        marginBottom: Platform.OS === 'ios' ? 40 : 20,
        borderRadius: 24,
        overflow: 'hidden',
    },
    blurContainer: {
        overflow: 'hidden',
        borderRadius: 24,
    },
    gradientOverlay: {
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        borderRadius: 24,
        position: 'relative',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    headerLeft: {
        flex: 1,
        marginRight: 16,
    },
    episodeLabel: {
        fontSize: 13,
        color: '#888',
        fontWeight: '600',
        marginBottom: 4,
    },
    episodeName: {
        fontSize: 20,
        color: '#fff',
        fontWeight: '700',
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cachedBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 12,
        marginBottom: 16,
    },
    cachedBannerText: {
        color: '#10B981',
        fontSize: 13,
        fontWeight: '500',
    },
    qualityTabs: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 16,
    },
    qualityTab: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    qualityTabActive: {
        backgroundColor: '#fff',
        borderColor: '#fff',
    },
    qualityTabText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#888',
    },
    qualityTabTextActive: {
        color: '#000',
    },
    loadingContainer: {
        height: 180,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#888',
    },
    errorContainer: {
        height: 150,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    errorText: {
        fontSize: 14,
        color: '#EF4444',
        textAlign: 'center',
        paddingHorizontal: 20,
    },
    emptyContainer: {
        height: 120,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    emptyText: {
        fontSize: 14,
        color: '#666',
    },
    torrentList: {
        // Dynamic max height based on screen - fills most of modal's available space
        maxHeight: height * 0.45,  // 45% of screen height for scroll area
        minHeight: 150,
    },
    torrentListContent: {
        paddingBottom: 60,  // Extra bottom padding for last items
        flexGrow: 1,
    },
    // Addon grouping styles
    addonSection: {
        marginBottom: 8,
    },
    addonHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 4,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
        marginBottom: 10,
    },
    addonName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#10B981',
    },
    addonCount: {
        fontSize: 12,
        color: '#888',
        marginLeft: 'auto',
    },
    addonIcon: {
        fontSize: 18,
        marginRight: 8,
    },
    addonEmpty: {
        paddingVertical: 20,
        paddingHorizontal: 16,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 12,
        alignItems: 'center',
    },
    addonEmptyText: {
        fontSize: 13,
        color: '#666',
        fontStyle: 'italic',
    },

    torrentItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: 14,
        borderRadius: 14,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    torrentLeft: {
        flex: 1,
        marginRight: 12,
    },
    torrentHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    torrentQuality: {
        fontSize: 15,
        fontWeight: '700',
        color: '#fff',
    },
    cachedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
    },
    cachedText: {
        fontSize: 10,
        color: '#10B981',
        fontWeight: '600',
    },
    torrentName: {
        fontSize: 13,
        color: '#fff',
        fontWeight: '500',
        lineHeight: 18,
        marginVertical: 4,
    },
    torrentSize: {
        fontSize: 12,
        fontWeight: '600',
        color: '#888',
        backgroundColor: 'rgba(255,255,255,0.08)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    torrentMeta: {
        fontSize: 11,
        color: '#666',
        marginTop: 4,
    },
    // Enhanced stream info styles
    qualityBadge: {
        backgroundColor: '#3B82F6',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4,
    },
    qualityText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#fff',
    },
    addonBadge: {
        fontSize: 10,
        fontWeight: '600',
        color: '#888',
        backgroundColor: 'rgba(255,255,255,0.08)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    specsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 4,
        flexWrap: 'wrap',
    },
    specBadge: {
        fontSize: 10,
        fontWeight: '600',
        color: '#aaa',
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    hdrBadge: {
        color: '#F59E0B',
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
    },
    audioBadge: {
        color: '#60A5FA',
        backgroundColor: 'rgba(96, 165, 250, 0.15)',
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 6,
        flexWrap: 'wrap',
    },
    sourceType: {
        fontSize: 10,
        fontWeight: '600',
        color: '#F59E0B',
    },
    sizeText: {
        fontSize: 10,
        fontWeight: '500',
        color: '#888',
    },
    seedsText: {
        fontSize: 10,
        fontWeight: '500',
        color: '#10B981',
    },
    langText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#888',
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 3,
    },
    // Plus button (initial state - green outline)
    actionButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#10B981',
        justifyContent: 'center',
        alignItems: 'center',
    },
    // Watch button (after added - golden for TV series)
    watchButton: {
        backgroundColor: '#EAB308', // Golden for TV series
    },
    // Loading button (while adding - darker)
    loadingButton: {
        backgroundColor: 'rgba(16, 185, 129, 0.6)',
    },
    playButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#10B981',
        justifyContent: 'center',
        alignItems: 'center',
    },
    // Status popup styles
    statusOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 24,
        zIndex: 100,
    },
    statusPopup: {
        alignItems: 'center',
        padding: 30,
        gap: 16,
    },
    successIcon: {
        marginBottom: 8,
    },
    statusText: {
        fontSize: 16,
        color: '#fff',
        fontWeight: '500',
        textAlign: 'center',
    },
    statusTextError: {
        fontSize: 16,
        color: '#EF4444',
        fontWeight: '500',
        textAlign: 'center',
    },
    playNowButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#10B981',
        paddingHorizontal: 32,
        paddingVertical: 16,
        borderRadius: 14,
        marginTop: 8,
    },
    playNowText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    dismissButton: {
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginTop: 8,
    },
    dismissText: {
        color: '#888',
        fontSize: 14,
        fontWeight: '500',
    },
    sortRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    sortLabel: {
        fontSize: 13,
        color: '#888',
        fontWeight: '500',
        marginRight: 4,
    },
    sortButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    sortButtonActive: {
        backgroundColor: '#fff',
        borderColor: '#fff',
    },
    sortButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#888',
    },
    sortButtonTextActive: {
        color: '#000',
    },
    // Season Packs Section
    seasonPackSection: {
        marginTop: 20,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
    },
    seasonPackHeader: {
        marginBottom: 12,
    },
    seasonPackTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 4,
    },
    seasonPackSubtitle: {
        fontSize: 12,
        color: '#888',
    },
    seasonPackItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(139, 92, 246, 0.15)',
        padding: 14,
        borderRadius: 14,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'rgba(139, 92, 246, 0.3)',
    },
    qualityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    // qualityBadge moved to enhanced stream info styles above
    inLibraryButton: {
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        borderWidth: 1,
        borderColor: '#10B981',
    },
    // Scraper tabs styles
    scraperTabsContainer: {
        maxHeight: 44,
        marginBottom: 12,
    },
    scraperTabsContent: {
        paddingRight: 12,
        gap: 8,
    },
    scraperTab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        gap: 6,
    },
    scraperTabActive: {
        backgroundColor: '#3B82F6',
        borderColor: '#3B82F6',
    },
    scraperTabText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#888',
    },
    scraperTabTextActive: {
        color: '#fff',
    },
    scraperTabBadge: {
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
        minWidth: 20,
        alignItems: 'center',
    },
    scraperTabBadgeActive: {
        backgroundColor: 'rgba(255,255,255,0.25)',
    },
    scraperTabBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#888',
    },
    scraperTabBadgeTextActive: {
        color: '#fff',
    },
    // Addon filter styles
    addonFilterRow: {
        maxHeight: 44,
        marginBottom: 12,
    },
    addonFilterContent: {
        paddingRight: 12,
        gap: 8,
    },
    addonFilterTab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    addonFilterTabActive: {
        backgroundColor: '#10B981',
        borderColor: '#10B981',
    },
    addonFilterText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#888',
    },
    addonFilterTextActive: {
        color: '#fff',
    },
});
