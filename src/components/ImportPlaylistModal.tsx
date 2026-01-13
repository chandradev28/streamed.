import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    ScrollView,
} from 'react-native';
import { X, Link, Music, AlertCircle, CheckCircle } from 'lucide-react-native';
import {
    importPlaylist,
    detectPlatform,
    ImportProgress,
    ImportResult,
    ImportedTrack,
} from '../services/playlistImportService';

interface ImportPlaylistModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const ImportPlaylistModal = ({ visible, onClose, onSuccess }: ImportPlaylistModalProps) => {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState<ImportProgress | null>(null);
    const [result, setResult] = useState<ImportResult | null>(null);

    const handleImport = async () => {
        if (!url.trim()) return;

        setLoading(true);
        setProgress(null);
        setResult(null);

        const importResult = await importPlaylist(url.trim(), setProgress);

        setResult(importResult);
        setLoading(false);

        if (importResult.success) {
            // Wait a moment then close
            setTimeout(() => {
                onSuccess();
                handleClose();
            }, 2000);
        }
    };

    const handleClose = () => {
        setUrl('');
        setLoading(false);
        setProgress(null);
        setResult(null);
        onClose();
    };

    const getPlatformColor = (platform: string) => {
        switch (platform) {
            case 'spotify': return '#1DB954';
            case 'apple': return '#FC3C44';
            case 'youtube': return '#FF0000';
            default: return '#888';
        }
    };

    const detectedPlatform = url.trim() ? detectPlatform(url) : null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={handleClose}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.title}>Import Playlist</Text>
                        <TouchableOpacity onPress={handleClose}>
                            <X color="#888" size={24} />
                        </TouchableOpacity>
                    </View>

                    {/* Instructions */}
                    <Text style={styles.subtitle}>
                        Paste a playlist link from Spotify, Apple Music, or YouTube Music
                    </Text>

                    {/* Platform badges */}
                    <View style={styles.platformBadges}>
                        <View style={[styles.badge, { backgroundColor: 'rgba(29, 185, 84, 0.15)' }]}>
                            <Text style={[styles.badgeText, { color: '#1DB954' }]}>Spotify</Text>
                        </View>
                        <View style={[styles.badge, { backgroundColor: 'rgba(252, 60, 68, 0.15)' }]}>
                            <Text style={[styles.badgeText, { color: '#FC3C44' }]}>Apple Music</Text>
                        </View>
                        <View style={[styles.badge, { backgroundColor: 'rgba(255, 0, 0, 0.15)' }]}>
                            <Text style={[styles.badgeText, { color: '#FF0000' }]}>YouTube Music</Text>
                        </View>
                    </View>

                    {/* URL Input */}
                    <View style={styles.inputContainer}>
                        <Link color="#666" size={20} />
                        <TextInput
                            style={styles.input}
                            placeholder="https://open.spotify.com/playlist/..."
                            placeholderTextColor="#555"
                            value={url}
                            onChangeText={setUrl}
                            autoCapitalize="none"
                            autoCorrect={false}
                            editable={!loading}
                        />
                        {detectedPlatform && detectedPlatform !== 'unknown' && (
                            <View style={[styles.detectedBadge, { backgroundColor: getPlatformColor(detectedPlatform) }]}>
                                <Text style={styles.detectedText}>{detectedPlatform}</Text>
                            </View>
                        )}
                    </View>

                    {/* Progress / Result */}
                    {loading && progress && (
                        <View style={styles.progressContainer}>
                            <ActivityIndicator size="small" color="#A78BFA" />
                            <Text style={styles.progressText}>{progress.message}</Text>
                            {progress.total > 0 && (
                                <Text style={styles.progressCount}>
                                    {progress.current} / {progress.total}
                                </Text>
                            )}
                        </View>
                    )}

                    {result && (
                        <View style={[
                            styles.resultContainer,
                            result.success ? styles.resultSuccess : styles.resultError
                        ]}>
                            {result.success ? (
                                <>
                                    <CheckCircle color="#10B981" size={24} />
                                    <View style={styles.resultContent}>
                                        <Text style={styles.resultTitle}>Import Successful!</Text>
                                        <Text style={styles.resultStats}>
                                            {result.matchedTracks} of {result.totalTracks} tracks matched
                                        </Text>
                                    </View>
                                </>
                            ) : (
                                <>
                                    <AlertCircle color="#EF4444" size={24} />
                                    <View style={styles.resultContent}>
                                        <Text style={styles.resultTitle}>Import Failed</Text>
                                        <Text style={styles.resultError}>{result.error}</Text>
                                    </View>
                                </>
                            )}
                        </View>
                    )}

                    {/* Unmatched tracks */}
                    {result?.unmatchedTracks && result.unmatchedTracks.length > 0 && (
                        <View style={styles.unmatchedContainer}>
                            <Text style={styles.unmatchedTitle}>
                                {result.unmatchedTracks.length} tracks not found:
                            </Text>
                            <ScrollView style={styles.unmatchedList} nestedScrollEnabled>
                                {result.unmatchedTracks.slice(0, 5).map((t, i) => (
                                    <Text key={i} style={styles.unmatchedTrack} numberOfLines={1}>
                                        • {t.title} - {t.artist}
                                    </Text>
                                ))}
                                {result.unmatchedTracks.length > 5 && (
                                    <Text style={styles.unmatchedMore}>
                                        + {result.unmatchedTracks.length - 5} more
                                    </Text>
                                )}
                            </ScrollView>
                        </View>
                    )}

                    {/* Import Button */}
                    <TouchableOpacity
                        style={[
                            styles.importButton,
                            (!url.trim() || loading || result?.success) && styles.importButtonDisabled,
                        ]}
                        onPress={handleImport}
                        disabled={!url.trim() || loading || result?.success}
                    >
                        {loading ? (
                            <ActivityIndicator size="small" color="#000" />
                        ) : (
                            <>
                                <Music color="#000" size={20} />
                                <Text style={styles.importButtonText}>Import Playlist</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    {/* Note */}
                    <Text style={styles.note}>
                        Note: Only public playlists can be imported
                    </Text>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: '#1a1a2e',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        maxHeight: '85%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
    },
    subtitle: {
        fontSize: 14,
        color: '#888',
        marginBottom: 16,
    },
    platformBadges: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    badge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '600',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        marginBottom: 16,
    },
    input: {
        flex: 1,
        fontSize: 15,
        color: '#fff',
        marginLeft: 10,
    },
    detectedBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    detectedText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#fff',
        textTransform: 'uppercase',
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: 'rgba(167, 139, 250, 0.1)',
        borderRadius: 12,
        padding: 14,
        marginBottom: 16,
    },
    progressText: {
        flex: 1,
        fontSize: 13,
        color: '#A78BFA',
    },
    progressCount: {
        fontSize: 12,
        color: '#888',
    },
    resultContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderRadius: 12,
        padding: 14,
        marginBottom: 16,
    },
    resultSuccess: {
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
    },
    resultError: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
    },
    resultContent: {
        flex: 1,
    },
    resultTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#fff',
    },
    resultStats: {
        fontSize: 13,
        color: '#10B981',
        marginTop: 2,
    },
    unmatchedContainer: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
        maxHeight: 120,
    },
    unmatchedTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#888',
        marginBottom: 8,
    },
    unmatchedList: {
        maxHeight: 80,
    },
    unmatchedTrack: {
        fontSize: 12,
        color: '#666',
        marginBottom: 4,
    },
    unmatchedMore: {
        fontSize: 12,
        color: '#555',
        fontStyle: 'italic',
    },
    importButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#A78BFA',
        paddingVertical: 16,
        borderRadius: 14,
        marginBottom: 12,
    },
    importButtonDisabled: {
        opacity: 0.5,
    },
    importButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#000',
    },
    note: {
        fontSize: 12,
        color: '#666',
        textAlign: 'center',
    },
});

export default ImportPlaylistModal;
