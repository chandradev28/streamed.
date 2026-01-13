import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Platform,
    StatusBar,
    RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
    ChevronLeft,
    RefreshCw,
    Clock,
    Zap,
    Check,
    Database,
} from 'lucide-react-native';
import { checkTorrentioHealth } from '../services/torrentio';
import { testZileanConnection } from '../services/zilean';
import { StorageService, IndexerType } from '../services/storage';

interface IndexerStatusScreenProps {
    navigation: any;
}

interface IndexerHealth {
    isOnline: boolean;
    responseTime: number;
    streamCount: number;
}

export const IndexerStatusScreen = ({ navigation }: IndexerStatusScreenProps) => {
    const insets = useSafeAreaInsets();
    const [torrentioHealth, setTorrentioHealth] = useState<IndexerHealth | null>(null);
    const [zileanHealth, setZileanHealth] = useState<IndexerHealth | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeIndexer, setActiveIndexer] = useState<IndexerType>('torrentio');
    const [lastChecked, setLastChecked] = useState<Date | null>(null);

    const loadActiveIndexer = useCallback(async () => {
        const indexer = await StorageService.getActiveIndexer();
        // Migrate old 'comet' setting to 'torrentio'
        if (indexer === 'comet' as any) {
            await StorageService.setActiveIndexer('torrentio');
            setActiveIndexer('torrentio');
        } else {
            setActiveIndexer(indexer);
        }
    }, []);

    const checkHealth = useCallback(async () => {
        setIsLoading(true);
        try {
            // Check Torrentio health
            const torrentioResult = await checkTorrentioHealth();
            setTorrentioHealth(torrentioResult);

            // Check Zilean health
            const zileanResult = await testZileanConnection();
            setZileanHealth({
                isOnline: zileanResult.success,
                responseTime: zileanResult.latency,
                streamCount: 0, // Zilean doesn't return stream count in health check
            });

            setLastChecked(new Date());
        } catch (error) {
            console.error('Error checking health:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadActiveIndexer();
        checkHealth();
    }, []);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await checkHealth();
        setRefreshing(false);
    }, [checkHealth]);

    const handleSelectIndexer = async (indexer: IndexerType) => {
        await StorageService.setActiveIndexer(indexer);
        setActiveIndexer(indexer);
    };

    const formatTime = (date: Date): string => {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const getStatusColor = (health: IndexerHealth | null) => {
        if (!health) return '#666';
        if (!health.isOnline) return '#EF4444';
        if (health.responseTime > 2000) return '#F59E0B';
        return '#10B981';
    };

    const renderIndexerCard = (
        name: string,
        indexerId: IndexerType,
        health: IndexerHealth | null
    ) => {
        const isActive = activeIndexer === indexerId;
        const statusColor = getStatusColor(health);

        return (
            <TouchableOpacity
                key={indexerId}
                style={[
                    styles.indexerCard,
                    isActive && styles.indexerCardActive,
                ]}
                onPress={() => handleSelectIndexer(indexerId)}
                activeOpacity={0.7}
            >
                <View style={styles.indexerCardContent}>
                    <View style={styles.indexerInfo}>
                        <View style={styles.indexerNameRow}>
                            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                            <Text style={styles.indexerName}>{name}</Text>
                        </View>
                        {health && !isLoading && (
                            <View style={styles.indexerStats}>
                                <View style={styles.statPill}>
                                    <Clock color="#888" size={12} />
                                    <Text style={styles.statText}>{health.responseTime}ms</Text>
                                </View>
                                <View style={styles.statPill}>
                                    <Zap color="#888" size={12} />
                                    <Text style={styles.statText}>{health.streamCount}</Text>
                                </View>
                            </View>
                        )}
                        {isLoading && (
                            <ActivityIndicator size="small" color="#888" style={{ marginTop: 4 }} />
                        )}
                    </View>

                    {/* Toggle Circle */}
                    <View style={[
                        styles.toggleCircle,
                        isActive && styles.toggleCircleActive,
                    ]}>
                        {isActive && <Check color="#fff" size={14} strokeWidth={3} />}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            <LinearGradient
                colors={['#0a0a0a', '#121212', '#0a0a0a']}
                style={styles.background}
            />

            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <ChevronLeft color="#fff" size={28} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Indexers</Text>
                <TouchableOpacity
                    style={styles.refreshButton}
                    onPress={onRefresh}
                    disabled={isLoading}
                >
                    <RefreshCw
                        color="#fff"
                        size={22}
                        style={isLoading ? { opacity: 0.5 } : undefined}
                    />
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor="#fff"
                    />
                }
            >
                {/* Section Header */}
                <Text style={styles.sectionTitle}>Choose Indexer</Text>
                <Text style={styles.sectionSubtitle}>
                    Select which indexer to use for finding cached torrents
                </Text>

                {/* Indexer Cards */}
                <View style={styles.indexersList}>
                    {renderIndexerCard('Torrentio', 'torrentio', torrentioHealth)}
                    {renderIndexerCard('Zilean (DMM)', 'zilean', zileanHealth)}
                </View>

                {/* Last Checked */}
                {lastChecked && (
                    <Text style={styles.lastChecked}>
                        Last checked: {formatTime(lastChecked)}
                    </Text>
                )}

                {/* Info Card */}
                <View style={styles.infoCard}>
                    <Text style={styles.infoText}>
                        Torrentio: 10 results per quality, limited but fast.{'\n'}
                        Zilean: Pre-cached DMM torrents, unlimited results.
                    </Text>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a0a',
    },
    background: {
        ...StyleSheet.absoluteFillObject,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
    },
    refreshButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 6,
    },
    sectionSubtitle: {
        fontSize: 14,
        color: '#888',
        marginBottom: 20,
    },
    indexersList: {
        gap: 12,
        marginBottom: 16,
    },
    indexerCard: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 16,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    indexerCardActive: {
        borderColor: '#10B981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
    },
    indexerCardContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    indexerInfo: {
        flex: 1,
    },
    indexerNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 10,
    },
    indexerName: {
        fontSize: 17,
        fontWeight: '600',
        color: '#fff',
    },
    indexerStats: {
        flexDirection: 'row',
        gap: 10,
        marginLeft: 18,
    },
    statPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    statText: {
        fontSize: 12,
        color: '#888',
    },
    toggleCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: '#444',
        justifyContent: 'center',
        alignItems: 'center',
    },
    toggleCircleActive: {
        backgroundColor: '#10B981',
        borderColor: '#10B981',
    },
    lastChecked: {
        color: '#666',
        fontSize: 12,
        textAlign: 'center',
        marginBottom: 20,
    },
    infoCard: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    infoText: {
        fontSize: 13,
        color: '#888',
        lineHeight: 20,
        textAlign: 'center',
    },
});
