import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    Platform,
    Alert,
    ScrollView,
    ActivityIndicator,
    Image,
    RefreshControl,
    Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { ArrowLeft, Eye, EyeOff, Check, Trash2, ExternalLink, HardDrive, RefreshCw, Play, Shield, Wifi, ChevronDown, ChevronUp, Plus } from 'lucide-react-native';
import { StorageService, DnsProviderType } from '../services/storage';
import { LinearGradient } from 'expo-linear-gradient';
import { getUserTorrents, TorBoxTorrent, getUserInfo, deleteTorrent, getInstantStreamUrl, getTorrentFilesWithUrls, getQuickStreamUrl } from '../services/torbox';
import { DNS_PROVIDERS, DnsProvider, clearDnsCache } from '../services/doh';
import { useNavigation } from '@react-navigation/native';


interface ProfileScreenProps {
    onBack: () => void;
}

export const ProfileScreen = ({ onBack }: ProfileScreenProps) => {
    const navigation = useNavigation<any>();
    const insets = useSafeAreaInsets();
    const [apiKey, setApiKey] = useState('');
    const [showApiKey, setShowApiKey] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isConfigured, setIsConfigured] = useState(false);

    // TorBox Library state
    const [torrents, setTorrents] = useState<TorBoxTorrent[]>([]);
    const [loadingTorrents, setLoadingTorrents] = useState(false);
    const [userInfo, setUserInfo] = useState<any>(null);

    // DNS Provider state
    const [dnsProvider, setDnsProvider] = useState<DnsProviderType>('none');

    // Deleting and playing torrent state
    const [deletingTorrents, setDeletingTorrents] = useState<Set<number>>(new Set());
    const [loadingPlayTorrents, setLoadingPlayTorrents] = useState<Set<number>>(new Set());
    const [expandedTorrents, setExpandedTorrents] = useState<Set<number>>(new Set());
    const [torrentFiles, setTorrentFiles] = useState<Map<number, any[]>>(new Map());

    useEffect(() => {
        loadApiKey();
        loadDnsProvider();
    }, []);

    useEffect(() => {
        if (isConfigured) {
            loadTorBoxData();
        }
    }, [isConfigured]);

    const loadApiKey = async () => {
        setIsLoading(true);
        const savedKey = await StorageService.getTorBoxApiKey();
        if (savedKey) {
            setApiKey(savedKey);
            setIsConfigured(true);
        }
        setIsLoading(false);
    };

    const loadDnsProvider = async () => {
        const provider = await StorageService.getDnsProvider();
        setDnsProvider(provider);
    };

    const handleDnsChange = async (provider: DnsProviderType) => {
        setDnsProvider(provider);
        await StorageService.setDnsProvider(provider);
        clearDnsCache(); // Clear cache when changing providers
        Alert.alert(
            'DNS Provider Updated',
            provider === 'none'
                ? 'Using system DNS'
                : `Using ${DNS_PROVIDERS[provider].name} DNS`
        );
    };

    const loadTorBoxData = async () => {
        setLoadingTorrents(true);
        try {
            const [userTorrents, info] = await Promise.all([
                getUserTorrents(),
                getUserInfo(),
            ]);
            setTorrents(userTorrents);
            setUserInfo(info);
            console.log('Loaded torrents:', userTorrents.length);
            console.log('User info:', info);
        } catch (error) {
            console.error('Error loading TorBox data:', error);
        } finally {
            setLoadingTorrents(false);
        }
    };

    // Direct API test for debugging
    const testTorBoxAPI = async () => {
        try {
            const key = await StorageService.getTorBoxApiKey();
            if (!key) {
                Alert.alert('Error', 'No API key found');
                return;
            }

            Alert.alert('Testing', 'Calling TorBox API...');

            const response = await fetch('https://api.torbox.app/v1/api/torrents/mylist?bypass_cache=true', {
                headers: {
                    'Authorization': `Bearer ${key}`,
                },
            });

            const responseText = await response.text();
            console.log('API Response Status:', response.status);
            console.log('API Response Body:', responseText);

            if (Platform.OS === 'web') {
                alert(`Status: ${response.status}\n\nResponse:\n${responseText.substring(0, 500)}`);
            } else {
                Alert.alert(
                    `Status: ${response.status}`,
                    responseText.substring(0, 300),
                    [{ text: 'OK' }]
                );
            }

            // Try to parse and reload
            if (response.ok) {
                const data = JSON.parse(responseText);
                if (data.success && data.data) {
                    setTorrents(Array.isArray(data.data) ? data.data : []);
                }
            }
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Unknown error');
            console.error('Test API error:', error);
        }
    };

    const handleSave = async () => {
        if (!apiKey.trim()) {
            Alert.alert('Error', 'Please enter your TorBox API key');
            return;
        }

        setIsSaving(true);
        const success = await StorageService.setTorBoxApiKey(apiKey.trim());
        setIsSaving(false);

        if (success) {
            setIsConfigured(true);
            Alert.alert('Success', 'TorBox API key saved successfully!');
        } else {
            Alert.alert('Error', 'Failed to save API key. Please try again.');
        }
    };

    const handleRemove = async () => {
        // Web-compatible confirmation
        if (Platform.OS === 'web') {
            const confirmed = window.confirm('Are you sure you want to remove your TorBox API key?');
            if (confirmed) {
                const success = await StorageService.removeTorBoxApiKey();
                if (success) {
                    setApiKey('');
                    setIsConfigured(false);
                    setTorrents([]);
                    setUserInfo(null);
                    alert('TorBox API key has been removed.');
                }
            }
        } else {
            Alert.alert(
                'Remove API Key',
                'Are you sure you want to remove your TorBox API key?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Remove',
                        style: 'destructive',
                        onPress: async () => {
                            const success = await StorageService.removeTorBoxApiKey();
                            if (success) {
                                setApiKey('');
                                setIsConfigured(false);
                                setTorrents([]);
                                setUserInfo(null);
                                Alert.alert('Removed', 'TorBox API key has been removed.');
                            }
                        },
                    },
                ]
            );
        }
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getStatusColor = (state: string) => {
        switch (state?.toLowerCase()) {
            case 'completed':
            case 'cached':
            case 'downloading':
                return '#10B981';
            case 'paused':
                return '#F59E0B';
            case 'error':
                return '#EF4444';
            default:
                return '#888';
        }
    };

    const handleDeleteTorrent = async (torrent: TorBoxTorrent) => {
        const confirmDelete = () => {
            return new Promise<boolean>((resolve) => {
                if (Platform.OS === 'web') {
                    resolve(window.confirm(`Delete "${torrent.name}"?`));
                } else {
                    Alert.alert(
                        'Delete Torrent',
                        `Are you sure you want to delete "${torrent.name}" from your TorBox library?`,
                        [
                            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                            { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
                        ]
                    );
                }
            });
        };

        const confirmed = await confirmDelete();
        if (!confirmed) return;

        setDeletingTorrents(prev => new Set(prev).add(torrent.id));

        try {
            const success = await deleteTorrent(torrent.id);
            if (success) {
                // Remove from local state
                setTorrents(prev => prev.filter(t => t.id !== torrent.id));
                if (Platform.OS === 'web') {
                    alert('Torrent deleted successfully');
                } else {
                    Alert.alert('Deleted', 'Torrent removed from your library');
                }
            } else {
                Alert.alert('Error', 'Failed to delete torrent');
            }
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to delete torrent');
        } finally {
            setDeletingTorrents(prev => {
                const next = new Set(prev);
                next.delete(torrent.id);
                return next;
            });
        }
    };

    // Handle playing a single-file torrent directly
    const handlePlaySingleFile = async (torrent: TorBoxTorrent) => {
        // Navigate IMMEDIATELY with torrentId - URL will be resolved lazily in VideoPlayer
        // This is much faster than waiting for file URLs to load
        navigation.navigate('VideoPlayer', {
            title: torrent.name,
            videoUrl: null, // Will be resolved in player
            posterUrl: null,
            torrentHash: torrent.hash,
            torrentId: torrent.id,
            provider: 'torbox',
            useTorBoxMode: true,
        });
    };

    // Toggle expand/collapse for multi-file torrents - INSTANT using torrent.files
    const handleToggleExpand = (torrent: TorBoxTorrent) => {
        // If already expanded, collapse it
        if (expandedTorrents.has(torrent.id)) {
            setExpandedTorrents(prev => {
                const next = new Set(prev);
                next.delete(torrent.id);
                return next;
            });
            return;
        }

        // Use files directly from torrent object (already loaded - INSTANT!)
        // No need to fetch URLs upfront - we'll get URL only when user clicks Play
        if (torrent.files && torrent.files.length > 0) {
            // Store files with normalized names (using short_name for display)
            setTorrentFiles(prev => new Map(prev).set(torrent.id, torrent.files.map((f: any, idx: number) => ({
                id: f.id,
                name: f.short_name || f.name?.split('/').pop() || f.name || `File ${idx + 1}`,
                size: f.size || 0,
                streamUrl: null, // URL will be fetched on-demand when playing
            }))));
            setExpandedTorrents(prev => new Set(prev).add(torrent.id));
        } else {
            Alert.alert('No Files', 'This torrent has no files to display.');
        }
    };

    // Track which file is loading URL
    const [loadingFileId, setLoadingFileId] = useState<number | null>(null);

    // Handle playing a specific file from expanded torrent - fetch URL on-demand
    const handlePlayFile = async (torrent: TorBoxTorrent, file: any, fileIndex: number, totalFiles: number) => {
        // If we already have a stream URL, play immediately
        if (file.streamUrl) {
            navigation.navigate('VideoPlayer', {
                title: file.short_name || file.name,
                videoUrl: file.streamUrl,
                posterUrl: null,
                torrentHash: torrent.hash,
                files: torrentFiles.get(torrent.id) || [],
                currentFileIndex: fileIndex,
                provider: 'torbox',
                useTorBoxMode: true,
            });
            return;
        }

        // Fetch URL on-demand for this specific file
        setLoadingFileId(file.id);
        try {
            const streamUrl = await getQuickStreamUrl(torrent.id, file.id);

            if (!streamUrl) {
                Alert.alert('Error', 'Could not get stream URL for this file');
                return;
            }

            // Update the cached file with URL
            setTorrentFiles(prev => {
                const files = prev.get(torrent.id) || [];
                const updatedFiles = files.map((f: any) =>
                    f.id === file.id ? { ...f, streamUrl } : f
                );
                return new Map(prev).set(torrent.id, updatedFiles);
            });

            // Navigate to video player
            navigation.navigate('VideoPlayer', {
                title: file.short_name || file.name,
                videoUrl: streamUrl,
                posterUrl: null,
                torrentHash: torrent.hash,
                torrentId: torrent.id,  // CRITICAL: Needed for file switching
                files: torrentFiles.get(torrent.id) || [],
                currentFileIndex: fileIndex,
                provider: 'torbox',
                useTorBoxMode: true,
            });
        } catch (error: any) {
            console.error('Error getting stream URL:', error);
            Alert.alert('Error', error.message || 'Failed to get stream URL');
        } finally {
            setLoadingFileId(null);
        }
    };

    const maskedApiKey = apiKey ? '•'.repeat(Math.min(apiKey.length, 32)) : '';

    return (
        <View style={styles.container}>
            <ScreenWrapper style={styles.screenWrapper}>
                {/* Header */}
                <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
                    <TouchableOpacity style={styles.backButton} onPress={onBack}>
                        <ArrowLeft color="#fff" size={24} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Settings</Text>
                    <TouchableOpacity
                        style={styles.addMagnetButton}
                        onPress={() => navigation.navigate('Magnet')}
                    >
                        <Plus color="#10B981" size={24} />
                    </TouchableOpacity>
                </View>

                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={loadingTorrents}
                            onRefresh={loadTorBoxData}
                            tintColor="#10B981"
                        />
                    }
                >
                    {/* TorBox Section */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <View style={styles.sectionIconContainer}>
                                <Image
                                    source={{ uri: 'https://torbox.app/logo.png' }}
                                    style={styles.torboxLogo}
                                    resizeMode="contain"
                                />
                            </View>
                            <View>
                                <Text style={styles.sectionTitle}>TorBox Integration</Text>
                                <Text style={styles.sectionSubtitle}>
                                    Connect your TorBox account for streaming
                                </Text>
                            </View>
                        </View>

                        {/* TorBox Referral Link - subtle promo */}
                        <TouchableOpacity
                            style={styles.referralButton}
                            onPress={() => Linking.openURL('https://torbox.app/subscription?referral=56bb3ffb-2cdd-4aa7-bc0d-d2b9d66eef98')}
                        >
                            <Text style={styles.referralText}>
                                Don't have TorBox? <Text style={styles.referralLink}>Get one here →</Text>
                            </Text>
                        </TouchableOpacity>
                        {isLoading ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="small" color="#fff" />
                            </View>
                        ) : (
                            <View style={styles.cardContainer}>
                                {/* Status Badge */}
                                <View style={styles.statusRow}>
                                    <View style={[
                                        styles.statusBadge,
                                        isConfigured ? styles.statusConnected : styles.statusDisconnected
                                    ]}>
                                        <View style={[
                                            styles.statusDot,
                                            { backgroundColor: isConfigured ? '#10B981' : '#EF4444' }
                                        ]} />
                                        <Text style={styles.statusText}>
                                            {isConfigured ? 'Connected' : 'Not Connected'}
                                        </Text>
                                    </View>
                                </View>

                                {/* API Key Input */}
                                <View style={styles.inputContainer}>
                                    <Text style={styles.inputLabel}>API Key</Text>
                                    <View style={styles.inputWrapper}>
                                        <TextInput
                                            style={styles.input}
                                            value={showApiKey ? apiKey : maskedApiKey}
                                            onChangeText={setApiKey}
                                            placeholder="Enter your TorBox API key"
                                            placeholderTextColor="#666"
                                            secureTextEntry={!showApiKey}
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                        />
                                        <TouchableOpacity
                                            style={styles.eyeButton}
                                            onPress={() => setShowApiKey(!showApiKey)}
                                        >
                                            {showApiKey ? (
                                                <EyeOff color="#888" size={20} />
                                            ) : (
                                                <Eye color="#888" size={20} />
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Action Buttons */}
                                <View style={styles.buttonRow}>
                                    <TouchableOpacity
                                        style={[styles.saveButton, isSaving && styles.buttonDisabled]}
                                        onPress={handleSave}
                                        disabled={isSaving}
                                    >
                                        <LinearGradient
                                            colors={['#10B981', '#059669']}
                                            style={styles.saveButtonGradient}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                        >
                                            {isSaving ? (
                                                <ActivityIndicator size="small" color="#fff" />
                                            ) : (
                                                <>
                                                    <Check color="#fff" size={18} />
                                                    <Text style={styles.saveButtonText}>Save Key</Text>
                                                </>
                                            )}
                                        </LinearGradient>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.removeButton}
                                        onPress={handleRemove}
                                    >
                                        <Trash2 color="#EF4444" size={18} />
                                    </TouchableOpacity>
                                </View>

                                {/* Help Link */}
                                <TouchableOpacity style={styles.helpLink}>
                                    <ExternalLink color="#888" size={14} />
                                    <Text style={styles.helpText}>
                                        Get your API key from torbox.app
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    {/* TorBox Library Section */}
                    {isConfigured && (
                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <View style={[styles.sectionIconContainer, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
                                    <HardDrive color="#6366F1" size={22} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.sectionTitle}>Your TorBox Library</Text>
                                    <Text style={styles.sectionSubtitle}>
                                        {torrents.length} torrent{torrents.length !== 1 ? 's' : ''} in your library
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.refreshButton}
                                    onPress={loadTorBoxData}
                                    disabled={loadingTorrents}
                                >
                                    <RefreshCw color="#888" size={18} />
                                </TouchableOpacity>
                            </View>

                            {loadingTorrents ? (
                                <View style={styles.loadingContainer}>
                                    <ActivityIndicator size="small" color="#fff" />
                                    <Text style={styles.loadingText}>Loading library...</Text>
                                </View>
                            ) : torrents.length === 0 ? (
                                <View style={styles.emptyLibrary}>
                                    <HardDrive color="#444" size={40} />
                                    <Text style={styles.emptyTitle}>No torrents yet</Text>
                                    <Text style={styles.emptySubtitle}>
                                        Add torrents by clicking the + button on cached streams
                                    </Text>
                                    <TouchableOpacity
                                        style={styles.testButton}
                                        onPress={testTorBoxAPI}
                                    >
                                        <Text style={styles.testButtonText}>Test API Connection</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <ScrollView
                                    style={styles.torrentsScrollView}
                                    nestedScrollEnabled={true}
                                    showsVerticalScrollIndicator={true}
                                >
                                    <View style={styles.torrentsList}>
                                        {torrents.map((torrent) => {
                                            const isExpanded = expandedTorrents.has(torrent.id);
                                            const isLoadingPlay = loadingPlayTorrents.has(torrent.id);
                                            const files = torrentFiles.get(torrent.id) || [];
                                            const isCached = torrent.download_state?.toLowerCase() === 'cached' ||
                                                torrent.download_state?.toLowerCase() === 'completed';
                                            // Check if multi-file based on torrent.files from API
                                            const isMultiFile = torrent.files && torrent.files.length > 1;

                                            return (
                                                <View key={torrent.id}>
                                                    <View style={[styles.torrentItem, isExpanded && styles.torrentItemExpanded]}>
                                                        <View style={styles.torrentInfo}>
                                                            <Text style={styles.torrentName} numberOfLines={2}>
                                                                {torrent.name}
                                                            </Text>
                                                            <View style={styles.torrentMeta}>
                                                                <View style={[
                                                                    styles.torrentStatus,
                                                                    { backgroundColor: `${getStatusColor(torrent.download_state)}20` }
                                                                ]}>
                                                                    <View style={[
                                                                        styles.statusDotSmall,
                                                                        { backgroundColor: getStatusColor(torrent.download_state) }
                                                                    ]} />
                                                                    <Text style={[
                                                                        styles.torrentStatusText,
                                                                        { color: getStatusColor(torrent.download_state) }
                                                                    ]}>
                                                                        {torrent.download_state || 'Unknown'}
                                                                    </Text>
                                                                </View>
                                                                <Text style={styles.torrentSize}>
                                                                    {formatBytes(torrent.size)}
                                                                </Text>
                                                            </View>
                                                        </View>

                                                        {/* Action Buttons */}
                                                        <View style={styles.torrentActions}>
                                                            {/* For multi-file torrents: show expand/collapse button */}
                                                            {isCached && isMultiFile && (
                                                                <TouchableOpacity
                                                                    style={[styles.torrentExpandButton, isExpanded && styles.torrentExpandButtonActive]}
                                                                    onPress={() => handleToggleExpand(torrent)}
                                                                    disabled={isLoadingPlay}
                                                                >
                                                                    {isLoadingPlay ? (
                                                                        <ActivityIndicator size="small" color="#3B82F6" />
                                                                    ) : (
                                                                        <ChevronDown
                                                                            color="#3B82F6"
                                                                            size={18}
                                                                            style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}
                                                                        />
                                                                    )}
                                                                </TouchableOpacity>
                                                            )}

                                                            {/* For single-file torrents: show play button */}
                                                            {isCached && !isMultiFile && (
                                                                <TouchableOpacity
                                                                    style={styles.torrentPlayButton}
                                                                    onPress={() => handlePlaySingleFile(torrent)}
                                                                    disabled={isLoadingPlay}
                                                                >
                                                                    {isLoadingPlay ? (
                                                                        <ActivityIndicator size="small" color="#10B981" />
                                                                    ) : (
                                                                        <Play color="#10B981" size={16} fill="#10B981" />
                                                                    )}
                                                                </TouchableOpacity>
                                                            )}

                                                            {/* Delete Button */}
                                                            <TouchableOpacity
                                                                style={styles.torrentDeleteButton}
                                                                onPress={() => handleDeleteTorrent(torrent)}
                                                                disabled={deletingTorrents.has(torrent.id)}
                                                            >
                                                                {deletingTorrents.has(torrent.id) ? (
                                                                    <ActivityIndicator size="small" color="#EF4444" />
                                                                ) : (
                                                                    <Trash2 color="#EF4444" size={16} />
                                                                )}
                                                            </TouchableOpacity>
                                                        </View>
                                                    </View>

                                                    {/* Expanded File List */}
                                                    {isExpanded && files.length > 0 && (
                                                        <View style={styles.fileListContainer}>
                                                            <Text style={styles.fileListTitle}>
                                                                {files.length} file{files.length > 1 ? 's' : ''}
                                                            </Text>
                                                            {files.map((file, index) => (
                                                                <TouchableOpacity
                                                                    key={file.id || index}
                                                                    style={styles.fileItem}
                                                                    onPress={() => handlePlayFile(torrent, file, index, files.length)}
                                                                >
                                                                    <View style={styles.fileInfo}>
                                                                        <Text style={styles.fileName} numberOfLines={1}>
                                                                            {file.short_name || file.name}
                                                                        </Text>
                                                                        <Text style={styles.fileSize}>
                                                                            {formatBytes(file.size)}
                                                                        </Text>
                                                                    </View>
                                                                    <Play color="#10B981" size={14} fill="#10B981" />
                                                                </TouchableOpacity>
                                                            ))}
                                                        </View>
                                                    )}
                                                </View>
                                            );
                                        })}
                                    </View>
                                </ScrollView>
                            )}
                        </View>
                    )}

                    {/* DNS over HTTPS Section */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <View style={[styles.sectionIconContainer, { backgroundColor: 'rgba(251, 146, 60, 0.15)' }]}>
                                <Shield color="#FB923C" size={22} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.sectionTitle}>ISP Bypass</Text>
                                <Text style={styles.sectionSubtitle}>
                                    DNS over HTTPS to bypass blocking
                                </Text>
                            </View>
                        </View>

                        <View style={styles.dnsOptions}>
                            {(Object.keys(DNS_PROVIDERS) as DnsProviderType[]).map((key) => {
                                const provider = DNS_PROVIDERS[key];
                                const isSelected = dnsProvider === key;
                                return (
                                    <TouchableOpacity
                                        key={key}
                                        style={[
                                            styles.dnsOption,
                                            isSelected && styles.dnsOptionSelected
                                        ]}
                                        onPress={() => handleDnsChange(key)}
                                    >
                                        <View style={styles.dnsOptionContent}>
                                            <View style={[
                                                styles.dnsRadio,
                                                isSelected && styles.dnsRadioSelected
                                            ]}>
                                                {isSelected && <View style={styles.dnsRadioInner} />}
                                            </View>
                                            <View style={styles.dnsOptionText}>
                                                <Text style={[
                                                    styles.dnsOptionName,
                                                    isSelected && styles.dnsOptionNameSelected
                                                ]}>
                                                    {provider.name}
                                                </Text>
                                                <Text style={styles.dnsOptionDesc}>
                                                    {provider.description}
                                                </Text>
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <Text style={styles.dnsHint}>
                            💡 Enable Cloudflare DNS if movies aren't loading on your network
                        </Text>
                    </View>

                </ScrollView>
            </ScreenWrapper>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a0a',
    },
    screenWrapper: {
        backgroundColor: 'transparent',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
        fontFamily: Platform.OS === 'ios' ? 'San Francisco' : 'sans-serif',
    },
    addMagnetButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.3)',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    section: {
        marginBottom: 32,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        overflow: 'hidden',
    },
    torboxLogo: {
        width: 28,
        height: 28,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
    },
    sectionSubtitle: {
        fontSize: 13,
        color: '#888',
        marginTop: 2,
    },
    loadingContainer: {
        height: 100,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardContainer: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    referralButton: {
        alignSelf: 'center',
        marginBottom: 16,
        paddingVertical: 8,
        paddingHorizontal: 16,
    },
    referralText: {
        fontSize: 13,
        color: '#888',
    },
    referralLink: {
        color: '#10B981',
        fontWeight: '600',
    },
    statusRow: {
        marginBottom: 20,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    statusConnected: {
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
    },
    statusDisconnected: {
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 8,
    },
    statusText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#fff',
    },
    inputContainer: {
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: 13,
        fontWeight: '500',
        color: '#888',
        marginBottom: 8,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.4)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    input: {
        flex: 1,
        height: 50,
        paddingHorizontal: 16,
        fontSize: 15,
        color: '#fff',
    },
    eyeButton: {
        padding: 12,
    },
    buttonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    saveButton: {
        flex: 1,
        borderRadius: 12,
        overflow: 'hidden',
    },
    saveButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        gap: 8,
    },
    saveButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#fff',
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    removeButton: {
        width: 50,
        height: 50,
        borderRadius: 12,
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
    },
    helpLink: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 16,
        gap: 6,
    },
    helpText: {
        fontSize: 13,
        color: '#888',
    },
    // TorBox Library styles
    refreshButton: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 8,
        fontSize: 13,
        color: '#888',
    },
    emptyLibrary: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 30,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        marginTop: 16,
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 13,
        color: '#666',
        textAlign: 'center',
    },
    torrentsScrollView: {
        maxHeight: 600,    // Increased from 400 for more visible content
        borderRadius: 16,
        overflow: 'hidden',
    },
    torrentsList: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    torrentItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.03)',
        marginBottom: 8,
    },
    torrentInfo: {
        flex: 1,
    },
    torrentName: {
        fontSize: 14,
        fontWeight: '500',
        color: '#fff',
        marginBottom: 8,
    },
    torrentMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    torrentStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        gap: 4,
    },
    statusDotSmall: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    torrentStatusText: {
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'capitalize',
    },
    torrentSize: {
        fontSize: 12,
        color: '#888',
    },
    moreText: {
        fontSize: 13,
        color: '#666',
        textAlign: 'center',
        paddingTop: 8,
    },
    torrentDeleteButton: {
        width: 36,
        height: 36,
        borderRadius: 8,
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    torrentItemExpanded: {
        backgroundColor: 'rgba(16, 185, 129, 0.08)',
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        marginBottom: 0,
    },
    torrentActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    torrentPlayButton: {
        width: 36,
        height: 36,
        borderRadius: 8,
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    torrentPlayButtonActive: {
        backgroundColor: 'rgba(16, 185, 129, 0.25)',
    },
    torrentExpandButton: {
        width: 36,
        height: 36,
        borderRadius: 8,
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    torrentExpandButtonActive: {
        backgroundColor: 'rgba(59, 130, 246, 0.25)',
    },
    fileListContainer: {
        backgroundColor: 'rgba(16, 185, 129, 0.05)',
        paddingHorizontal: 12,
        paddingBottom: 12,
        borderBottomLeftRadius: 10,
        borderBottomRightRadius: 10,
        marginBottom: 8,
        borderWidth: 1,
        borderTopWidth: 0,
        borderColor: 'rgba(16, 185, 129, 0.15)',
    },
    fileListTitle: {
        fontSize: 12,
        color: '#10B981',
        fontWeight: '600',
        marginBottom: 8,
        marginTop: 4,
    },
    fileItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 12,
        marginBottom: 6,
    },
    fileInfo: {
        flex: 1,
        marginRight: 12,
    },
    fileName: {
        fontSize: 13,
        color: '#fff',
        fontWeight: '500',
        marginBottom: 2,
    },
    fileSize: {
        fontSize: 11,
        color: '#888',
    },
    testButton: {
        marginTop: 16,
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: 'rgba(99, 102, 241, 0.2)',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.4)',
    },
    testButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6366F1',
    },
    // DNS Settings Styles
    dnsOptions: {
        marginTop: 12,
    },
    dnsOption: {
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    dnsOptionSelected: {
        backgroundColor: 'rgba(251, 146, 60, 0.1)',
        borderColor: 'rgba(251, 146, 60, 0.4)',
    },
    dnsOptionContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
    },
    dnsRadio: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: '#444',
        marginRight: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dnsRadioSelected: {
        borderColor: '#FB923C',
    },
    dnsRadioInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#FB923C',
    },
    dnsOptionText: {
        flex: 1,
    },
    dnsOptionName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 2,
    },
    dnsOptionNameSelected: {
        color: '#FB923C',
    },
    dnsOptionDesc: {
        fontSize: 12,
        color: '#888',
    },
    dnsHint: {
        fontSize: 12,
        color: '#666',
        textAlign: 'center',
        marginTop: 12,
        paddingHorizontal: 10,
    },
});
