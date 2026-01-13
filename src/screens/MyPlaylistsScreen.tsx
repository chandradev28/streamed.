import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Dimensions,
    Alert,
    TextInput,
    Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
    ChevronLeft,
    Plus,
    ListMusic,
    Play,
    MoreVertical,
    Trash2,
    Edit3,
    Download,
} from 'lucide-react-native';
import { Image } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';
import { MusicMiniPlayer } from '../components/MusicMiniPlayer';
import { ImportPlaylistModal } from '../components/ImportPlaylistModal';
import { StorageService, UserPlaylist } from '../services/storage';
import {
    getState,
    addPlaybackListener,
    PlaybackState,
} from '../services/musicPlayerService';
import { useMusicColors } from '../hooks/useMusicColors';

const { width } = Dimensions.get('window');

interface MyPlaylistsScreenProps {
    navigation: any;
}

export const MyPlaylistsScreen = ({ navigation }: MyPlaylistsScreenProps) => {
    const insets = useSafeAreaInsets();
    const musicColors = useMusicColors();
    const [playlists, setPlaylists] = useState<UserPlaylist[]>([]);
    const [playerState, setPlayerState] = useState<PlaybackState>(getState());
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [newPlaylistName, setNewPlaylistName] = useState('');

    // Load playlists when screen is focused
    useFocusEffect(
        useCallback(() => {
            loadPlaylists();
            const unsubscribe = addPlaybackListener(setPlayerState);
            return unsubscribe;
        }, [])
    );

    const loadPlaylists = async () => {
        const userPlaylists = await StorageService.getUserPlaylists();
        setPlaylists(userPlaylists);
    };

    const handleCreatePlaylist = async () => {
        if (!newPlaylistName.trim()) {
            Alert.alert('Error', 'Please enter a playlist name');
            return;
        }
        await StorageService.createPlaylist(newPlaylistName.trim());
        setNewPlaylistName('');
        setShowCreateModal(false);
        loadPlaylists();
    };

    const handleDeletePlaylist = (playlist: UserPlaylist) => {
        Alert.alert(
            'Delete Playlist',
            `Are you sure you want to delete "${playlist.name}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        await StorageService.deletePlaylist(playlist.id);
                        loadPlaylists();
                    },
                },
            ]
        );
    };

    const handlePlaylistPress = (playlist: UserPlaylist) => {
        navigation.navigate('UserPlaylist', { playlist });
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={playerState.currentSong ? musicColors.gradientColors : ['#1a1033', '#0d1b2a', '#0a0a14']}
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
                <Text style={styles.headerTitle}>My Playlists</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                    {/* Import button */}
                    <TouchableOpacity
                        style={styles.addButton}
                        onPress={() => setShowImportModal(true)}
                    >
                        <Download color="#A78BFA" size={22} />
                    </TouchableOpacity>
                    {/* Create button */}
                    <TouchableOpacity
                        style={styles.addButton}
                        onPress={() => setShowCreateModal(true)}
                    >
                        <Plus color="#A78BFA" size={24} />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
            >
                {playlists.length === 0 ? (
                    <View style={styles.emptyState}>
                        <ListMusic color="#555" size={64} />
                        <Text style={styles.emptyTitle}>No Playlists Yet</Text>
                        <Text style={styles.emptySubtitle}>
                            Create your first playlist to get started
                        </Text>
                        <TouchableOpacity
                            style={styles.createButton}
                            onPress={() => setShowCreateModal(true)}
                        >
                            <Plus color="#000" size={20} />
                            <Text style={styles.createButtonText}>Create Playlist</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.playlistGrid}>
                        {/* Create New Card */}
                        <TouchableOpacity
                            style={styles.createCard}
                            onPress={() => setShowCreateModal(true)}
                        >
                            <View style={styles.createCardIcon}>
                                <Plus color="#A78BFA" size={32} />
                            </View>
                            <Text style={styles.createCardText}>Create New</Text>
                        </TouchableOpacity>

                        {/* Playlist Cards */}
                        {playlists.map((playlist) => (
                            <TouchableOpacity
                                key={playlist.id}
                                style={styles.playlistCard}
                                onPress={() => handlePlaylistPress(playlist)}
                                onLongPress={() => handleDeletePlaylist(playlist)}
                            >
                                <View style={styles.playlistCoverContainer}>
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
                                    {/* Delete button */}
                                    <TouchableOpacity
                                        style={styles.deleteButton}
                                        onPress={() => handleDeletePlaylist(playlist)}
                                    >
                                        <Trash2 color="#fff" size={16} />
                                    </TouchableOpacity>
                                </View>
                                <Text style={styles.playlistName} numberOfLines={1}>
                                    {playlist.name}
                                </Text>
                                <Text style={styles.playlistMeta}>
                                    {playlist.tracks.length} tracks
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

            {/* Create Playlist Modal */}
            <Modal
                visible={showCreateModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowCreateModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Create Playlist</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="Playlist name"
                            placeholderTextColor="#666"
                            value={newPlaylistName}
                            onChangeText={setNewPlaylistName}
                            autoFocus
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={styles.modalCancelButton}
                                onPress={() => {
                                    setNewPlaylistName('');
                                    setShowCreateModal(false);
                                }}
                            >
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.modalCreateButton}
                                onPress={handleCreatePlaylist}
                            >
                                <Text style={styles.modalCreateText}>Create</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Import Playlist Modal */}
            <ImportPlaylistModal
                visible={showImportModal}
                onClose={() => setShowImportModal(false)}
                onSuccess={loadPlaylists}
            />
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
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
    },
    addButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(167, 139, 250, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        paddingHorizontal: 16,
    },
    emptyState: {
        alignItems: 'center',
        paddingTop: 80,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#fff',
        marginTop: 16,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#888',
        marginTop: 8,
        textAlign: 'center',
    },
    createButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#A78BFA',
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 12,
        marginTop: 24,
    },
    createButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000',
    },
    playlistGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    createCard: {
        width: (width - 48) / 2,
        aspectRatio: 1,
        borderRadius: 12,
        backgroundColor: 'rgba(167, 139, 250, 0.1)',
        borderWidth: 2,
        borderColor: 'rgba(167, 139, 250, 0.3)',
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    createCardIcon: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(167, 139, 250, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    createCardText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#A78BFA',
        marginTop: 12,
    },
    playlistCard: {
        width: (width - 48) / 2,
        marginBottom: 16,
    },
    playlistCoverContainer: {
        position: 'relative',
    },
    deleteButton: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(239, 68, 68, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    playlistCover: {
        width: '100%',
        aspectRatio: 1,
        borderRadius: 12,
        backgroundColor: '#1a1a1a',
    },
    playlistCoverPlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    playlistName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
        marginTop: 8,
    },
    playlistMeta: {
        fontSize: 12,
        color: '#888',
        marginTop: 2,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        width: '100%',
        maxWidth: 340,
        backgroundColor: '#1a1a2e',
        borderRadius: 16,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(167, 139, 250, 0.3)',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 20,
        textAlign: 'center',
    },
    modalInput: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 14,
        fontSize: 16,
        color: '#fff',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 20,
    },
    modalCancelButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
    },
    modalCancelText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#888',
    },
    modalCreateButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: '#A78BFA',
        alignItems: 'center',
    },
    modalCreateText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000',
    },
});

export default MyPlaylistsScreen;
