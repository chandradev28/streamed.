import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Platform,
    ActivityIndicator,
    TextInput,
    Alert,
    Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Trash2, RefreshCw, Puzzle, Film, Tv, Subtitles, Settings } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    stremioService,
    installAddon,
    removeAddon,
    getInstalledAddons,
    AddonManifest,
} from '../services/stremioService';

const ADDONS_ENABLED_KEY = '@streamed_addons_enabled';

interface AddonsScreenProps {
    navigation: any;
}

// Get icon for addon based on its resources/catalogs
const getAddonIcon = (addon: AddonManifest) => {
    const hasSubtitles = addon.resources?.some((r: any) =>
        (typeof r === 'string' && r === 'subtitles') ||
        (typeof r === 'object' && r.name === 'subtitles')
    );

    const types = addon.types || [];

    if (hasSubtitles) return <Subtitles color="#10B981" size={24} />;
    if (types.includes('series') && !types.includes('movie')) return <Tv color="#3B82F6" size={24} />;
    if (types.includes('movie') && !types.includes('series')) return <Film color="#EF4444" size={24} />;
    return <Puzzle color="#8B5CF6" size={24} />;
};

// Get icon background color
const getAddonIconBg = (addon: AddonManifest) => {
    const hasSubtitles = addon.resources?.some((r: any) =>
        (typeof r === 'string' && r === 'subtitles') ||
        (typeof r === 'object' && r.name === 'subtitles')
    );

    const types = addon.types || [];

    if (hasSubtitles) return 'rgba(16, 185, 129, 0.15)';
    if (types.includes('series') && !types.includes('movie')) return 'rgba(59, 130, 246, 0.15)';
    if (types.includes('movie') && !types.includes('series')) return 'rgba(239, 68, 68, 0.15)';
    return 'rgba(139, 92, 246, 0.15)';
};

export const AddonsScreen = ({ navigation }: AddonsScreenProps) => {
    const insets = useSafeAreaInsets();
    const [installedAddons, setInstalledAddons] = useState<AddonManifest[]>([]);
    const [loading, setLoading] = useState(true);
    const [installing, setInstalling] = useState(false);
    const [addonUrl, setAddonUrl] = useState('');
    const [useAddons, setUseAddons] = useState(false);

    // Calculate stats
    const totalAddons = installedAddons.length;
    const activeAddons = installedAddons.filter(a =>
        a.resources?.some((r: any) =>
            (typeof r === 'string' && r === 'stream') ||
            (typeof r === 'object' && r.name === 'stream')
        )
    ).length;
    const totalCatalogs = installedAddons.reduce((sum, a) => sum + (a.catalogs?.length || 0), 0);

    const loadAddons = useCallback(async () => {
        try {
            const addons = await getInstalledAddons();
            setInstalledAddons(addons);

            // Load addon toggle state
            const enabled = await AsyncStorage.getItem(ADDONS_ENABLED_KEY);
            setUseAddons(enabled === 'true'); // Default to false (use indexers)
        } catch (error) {
            console.error('Error loading addons:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadAddons();
    }, [loadAddons]);

    const handleToggleAddons = async () => {
        const newValue = !useAddons;
        setUseAddons(newValue);
        await AsyncStorage.setItem(ADDONS_ENABLED_KEY, newValue ? 'true' : 'false');
    };

    const handleAddAddon = async () => {
        const url = addonUrl.trim();
        if (!url) {
            Alert.alert('Error', 'Please enter an addon URL');
            return;
        }

        setInstalling(true);
        try {
            const manifest = await installAddon(url);
            setAddonUrl('');
            await loadAddons();
            Alert.alert('Success', `${manifest.name} installed successfully!`);
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to install addon');
        } finally {
            setInstalling(false);
        }
    };

    const handleRemoveAddon = async (addon: AddonManifest) => {
        Alert.alert(
            'Remove Addon',
            `Are you sure you want to remove ${addon.name}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        await removeAddon(addon.id);
                        await loadAddons();
                    },
                },
            ]
        );
    };

    // Get configure URL from addon's original URL
    const getConfigureUrl = (addon: AddonManifest): string | null => {
        const originalUrl = addon.originalUrl;
        if (!originalUrl) return null;

        try {
            // Extract base URL (before any config path)
            const url = new URL(originalUrl);
            const baseUrl = `${url.protocol}//${url.host}`;

            // Common addon configure paths
            if (originalUrl.includes('comet.')) return `${baseUrl}/configure`;
            if (originalUrl.includes('mediafusion.')) return `${baseUrl}/configure`;
            if (originalUrl.includes('torrentio.')) return 'https://torrentio.strem.fun/configure';
            if (originalUrl.includes('stremthru.')) return `${baseUrl}/configure`;

            // Default: return base URL (most addons have configure at root or /configure)
            return `${baseUrl}/configure`;
        } catch {
            return null;
        }
    };

    const handleConfigureAddon = (addon: AddonManifest) => {
        const configUrl = getConfigureUrl(addon);
        if (configUrl) {
            Linking.openURL(configUrl);
        } else {
            Alert.alert('Configure', 'Configure URL not available for this addon.');
        }
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#10B981" />
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <ArrowLeft color="#3B82F6" size={24} />
                    <Text style={styles.backText}>Settings</Text>
                </TouchableOpacity>
                <View style={styles.headerRight}>
                    <TouchableOpacity style={styles.iconButton} onPress={loadAddons}>
                        <RefreshCw color="#fff" size={20} />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                {/* Title */}
                <Text style={styles.pageTitle}>Addons</Text>

                {/* Source Toggle */}
                <TouchableOpacity
                    style={[styles.toggleCard, useAddons && styles.toggleCardActive]}
                    onPress={handleToggleAddons}
                >
                    <View style={styles.toggleInfo}>
                        <Text style={styles.toggleTitle}>
                            {useAddons ? 'Using Addons' : 'Using Indexer Only'}
                        </Text>
                        <Text style={styles.toggleDescription}>
                            {useAddons
                                ? 'Streams from installed addons'
                                : 'Streams from TorBox indexer only'}
                        </Text>
                    </View>
                    <View style={[styles.toggleSwitch, useAddons && styles.toggleSwitchActive]}>
                        <View style={[styles.toggleDot, useAddons && styles.toggleDotActive]} />
                    </View>
                </TouchableOpacity>

                {/* Overview Section */}
                <Text style={styles.sectionLabel}>OVERVIEW</Text>
                <View style={styles.overviewCard}>
                    <View style={styles.overviewItem}>
                        <Text style={styles.overviewNumber}>{totalAddons}</Text>
                        <Text style={styles.overviewLabel}>Addons</Text>
                    </View>
                    <View style={styles.overviewDivider} />
                    <View style={styles.overviewItem}>
                        <Text style={styles.overviewNumber}>{activeAddons}</Text>
                        <Text style={styles.overviewLabel}>Active</Text>
                    </View>
                    <View style={styles.overviewDivider} />
                    <View style={styles.overviewItem}>
                        <Text style={styles.overviewNumber}>{totalCatalogs}</Text>
                        <Text style={styles.overviewLabel}>Catalogs</Text>
                    </View>
                </View>

                {/* Add New Addon Section */}
                <Text style={styles.sectionLabel}>ADD STREMIO ADDON</Text>
                <View style={styles.addSection}>
                    <TextInput
                        style={styles.urlInput}
                        placeholder="Addon URL"
                        placeholderTextColor="#666"
                        value={addonUrl}
                        onChangeText={setAddonUrl}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                    <TouchableOpacity
                        style={[styles.addButton, installing && styles.addButtonDisabled]}
                        onPress={handleAddAddon}
                        disabled={installing}
                    >
                        {installing ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Text style={styles.addButtonText}>Add Addon</Text>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Installed Addons Section */}
                <Text style={styles.sectionLabel}>INSTALLED ADDONS</Text>

                {installedAddons.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Puzzle color="#444" size={48} />
                        <Text style={styles.emptyStateText}>No addons installed</Text>
                        <Text style={styles.emptyStateSubtext}>
                            Add addons by pasting their manifest URL above
                        </Text>
                    </View>
                ) : (
                    installedAddons.map((addon) => (
                        <View key={addon.id} style={styles.addonCard}>
                            <View style={[styles.addonIcon, { backgroundColor: getAddonIconBg(addon) }]}>
                                {getAddonIcon(addon)}
                            </View>
                            <View style={styles.addonInfo}>
                                <View style={styles.addonHeader}>
                                    <Text style={styles.addonName}>{addon.name}</Text>
                                    <View style={styles.addonActions}>
                                        <TouchableOpacity
                                            style={styles.configureButton}
                                            onPress={() => handleConfigureAddon(addon)}
                                        >
                                            <Settings color="#3B82F6" size={18} />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.deleteButton}
                                            onPress={() => handleRemoveAddon(addon)}
                                        >
                                            <Trash2 color="#EF4444" size={18} />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                                <Text style={styles.addonMeta}>
                                    v{addon.version || '1.0.0'} • {addon.types?.join(' • ') || 'Movie • Series'}
                                </Text>
                                <Text style={styles.addonDescription} numberOfLines={2}>
                                    {addon.description || 'No description available'}
                                </Text>
                            </View>
                        </View>
                    ))
                )}

                {/* Help Text */}
                <View style={styles.helpSection}>
                    <Text style={styles.helpTitle}>How to add addons</Text>
                    <Text style={styles.helpText}>
                        1. Visit an addon's website (e.g., torrentio.strem.fun){'\n'}
                        2. Configure your preferences{'\n'}
                        3. Copy the manifest URL{'\n'}
                        4. Paste it above and tap "Add Addon"
                    </Text>
                    <View style={styles.helpLinks}>
                        <TouchableOpacity
                            style={styles.helpLink}
                            onPress={() => Linking.openURL('https://torrentio.strem.fun/configure')}
                        >
                            <Text style={styles.helpLinkText}>Torrentio</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.helpLink}
                            onPress={() => Linking.openURL('https://mediafusion.elfhosted.com/configure')}
                        >
                            <Text style={styles.helpLinkText}>MediaFusion</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.helpLink}
                            onPress={() => Linking.openURL('https://comet.elfhosted.com/configure')}
                        >
                            <Text style={styles.helpLinkText}>Comet</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a0a',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    backText: {
        fontSize: 17,
        color: '#3B82F6',
    },
    headerRight: {
        flexDirection: 'row',
        gap: 12,
    },
    iconButton: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.08)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingBottom: 40,
    },
    pageTitle: {
        fontSize: 34,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 24,
    },
    toggleCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    toggleCardActive: {
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderColor: 'rgba(16, 185, 129, 0.3)',
    },
    toggleInfo: {
        flex: 1,
    },
    toggleTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    toggleDescription: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.5)',
        marginTop: 2,
    },
    zileanCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    zileanCardActive: {
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        borderColor: 'rgba(139, 92, 246, 0.3)',
    },
    zileanIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: 'rgba(139, 92, 246, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    zileanSwitchActive: {
        backgroundColor: '#8B5CF6',
    },
    zileanWarning: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
        gap: 4,
    },
    zileanWarningText: {
        fontSize: 11,
        color: '#F59E0B',
    },
    toggleSwitch: {
        width: 50,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        paddingHorizontal: 3,
    },
    toggleSwitchActive: {
        backgroundColor: '#10B981',
    },
    toggleDot: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#fff',
    },
    toggleDotActive: {
        alignSelf: 'flex-end',
    },
    torrentioCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    torrentioCardActive: {
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderColor: 'rgba(245, 158, 11, 0.3)',
    },
    torrentioIcon: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    torrentioInfo: {
        flex: 1,
    },
    torrentioName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    torrentioDesc: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
        marginTop: 2,
    },
    sectionLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#666',
        marginBottom: 10,
        letterSpacing: 0.5,
    },
    overviewCard: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
    },
    overviewItem: {
        flex: 1,
        alignItems: 'center',
    },
    overviewNumber: {
        fontSize: 28,
        fontWeight: '700',
        color: '#fff',
    },
    overviewLabel: {
        fontSize: 13,
        color: '#888',
        marginTop: 4,
    },
    overviewDivider: {
        width: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginVertical: 5,
    },
    addSection: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
    },
    urlInput: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 10,
        padding: 14,
        fontSize: 15,
        color: '#fff',
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    addButton: {
        backgroundColor: '#2563EB',
        borderRadius: 10,
        padding: 14,
        alignItems: 'center',
    },
    addButtonDisabled: {
        opacity: 0.6,
    },
    addButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyStateText: {
        fontSize: 17,
        fontWeight: '600',
        color: '#666',
        marginTop: 16,
    },
    emptyStateSubtext: {
        fontSize: 14,
        color: '#555',
        marginTop: 8,
        textAlign: 'center',
    },
    addonCard: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
    },
    addonIcon: {
        width: 48,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    addonInfo: {
        flex: 1,
    },
    addonHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    addonName: {
        fontSize: 17,
        fontWeight: '600',
        color: '#fff',
        flex: 1,
    },
    deleteButton: {
        padding: 4,
    },
    addonActions: {
        flexDirection: 'row',
        gap: 8,
    },
    configureButton: {
        padding: 4,
    },
    addonMeta: {
        fontSize: 13,
        color: '#888',
        marginTop: 2,
    },
    addonDescription: {
        fontSize: 14,
        color: '#666',
        marginTop: 6,
        lineHeight: 20,
    },
    helpSection: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 16,
        padding: 16,
        marginTop: 16,
    },
    helpTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#888',
        marginBottom: 12,
    },
    helpText: {
        fontSize: 14,
        color: '#666',
        lineHeight: 22,
    },
    helpLinks: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginTop: 16,
    },
    helpLink: {
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
    },
    helpLinkText: {
        fontSize: 13,
        color: '#3B82F6',
        fontWeight: '500',
    },
});
