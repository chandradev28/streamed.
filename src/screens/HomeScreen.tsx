import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { Colors } from '../constants/Colors';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { HeaderNav } from '../components/HeaderNav';
import { MovieCarousel } from '../components/MovieCarousel';
import { ContinueWatchingCard } from '../components/ContinueWatchingCard';
import { NewReleasedSection } from '../components/NewReleasedSection';
import { MenuOverlay } from '../components/MenuOverlay';
import { TorboxersSection } from '../components/TorboxersSection';
import { Home, MonitorPlay, Search, FolderOpen, ChevronRight } from 'lucide-react-native';
import { PlaylistScreen } from './PlaylistScreen';
import { SearchScreen } from './SearchScreen';
import { LibraryScreen } from './LibraryScreen';
import { ProfileScreen } from './ProfileScreen';

type Tab = 'Home' | 'Playlist' | 'Search' | 'Library';
type SourceMode = 'streamed' | 'torboxers';

// Header height constant for dynamic spacing
const HEADER_HEIGHT = 68;

export const HomeScreen = () => {
    const navigation = useNavigation<any>();
    const insets = useSafeAreaInsets();
    const [currentTab, setCurrentTab] = useState<Tab>('Home');
    const [showProfile, setShowProfile] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [sourceMode, setSourceMode] = useState<SourceMode>('streamed');

    const handleMenuNavigate = (screenId: string) => {
        if (screenId === 'music') {
            navigation.navigate('MusicHome');
        } else if (screenId === 'indexers') {
            navigation.navigate('IndexerStatus');
        } else if (screenId === 'addons') {
            navigation.navigate('Addons');
        } else if (screenId === 'scrapers') {
            navigation.navigate('Scrapers');
        } else if (screenId === 'settings') {
            setShowProfile(true);
        }
    };

    const renderContent = () => {
        if (currentTab === 'Playlist') {
            return <PlaylistScreen />;
        }
        if (currentTab === 'Search') {
            return <SearchScreen />;
        }
        if (currentTab === 'Library') {
            return <LibraryScreen />;
        }

        // Home Content - switches between Streamed and Torboxers based on capsule
        return (
            <ScreenWrapper style={styles.screenWrapper}>
                <HeaderNav
                    onProfilePress={() => setShowProfile(true)}
                    onMenuPress={() => setShowMenu(true)}
                    sourceMode={sourceMode}
                    onSourceModeChange={setSourceMode}
                />

                {sourceMode === 'streamed' ? (
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        style={styles.scrollView}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Dynamic spacer for fixed Header based on safe area */}
                        <View style={{ height: insets.top + HEADER_HEIGHT }} />

                        <MovieCarousel />

                        {/* Continue Watching Section */}
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Continue Watching</Text>
                            <ChevronRight color={Colors.dark.text} size={20} />
                        </View>
                        <ContinueWatchingCard />

                        {/* New Released Section */}
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>New Released</Text>
                            <ChevronRight color={Colors.dark.text} size={20} />
                        </View>
                        <NewReleasedSection />

                        {/* Spacer for Bottom Nav */}
                        <View style={{ height: 100 }} />
                    </ScrollView>
                ) : (
                    <TorboxersSection onNavigate={(screen) => navigation.navigate(screen)} />
                )}
            </ScreenWrapper>
        );
    };

    // Show ProfileScreen as overlay
    if (showProfile) {
        return <ProfileScreen onBack={() => setShowProfile(false)} />;
    }

    return (
        <View style={styles.mainContainer}>
            {renderContent()}

            {/* Menu Overlay */}
            <MenuOverlay
                visible={showMenu}
                onClose={() => setShowMenu(false)}
                onNavigate={handleMenuNavigate}
            />

            {/* Bottom Navigation Footer - Glass Effect (hidden in Torboxers mode) */}
            {!(currentTab === 'Home' && sourceMode === 'torboxers') && (
                <View style={styles.footerContainer}>
                    <BlurView intensity={60} tint="dark" style={styles.footerBlur}>
                        <View style={styles.footerGradient}>
                            <View style={styles.tabBar}>
                                <TouchableOpacity
                                    style={[styles.tabItem, currentTab === 'Home' && styles.tabItemActive]}
                                    onPress={() => setCurrentTab('Home')}
                                >
                                    <View style={currentTab === 'Home' ? styles.tabIconActive : styles.tabIcon}>
                                        <Home
                                            color={currentTab === 'Home' ? '#1a1a1a' : Colors.dark.textSecondary}
                                            size={22}
                                            fill={currentTab === 'Home' ? '#1a1a1a' : 'transparent'}
                                        />
                                    </View>
                                    <Text style={[styles.tabLabel, currentTab === 'Home' && styles.tabLabelActive]}>Home</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.tabItem, currentTab === 'Playlist' && styles.tabItemActive]}
                                    onPress={() => setCurrentTab('Playlist')}
                                >
                                    <View style={currentTab === 'Playlist' ? styles.tabIconActive : styles.tabIcon}>
                                        <MonitorPlay
                                            color={currentTab === 'Playlist' ? '#1a1a1a' : Colors.dark.textSecondary}
                                            size={22}
                                        />
                                    </View>
                                    <Text style={[styles.tabLabel, currentTab === 'Playlist' && styles.tabLabelActive]}>Playlist</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.tabItem, currentTab === 'Search' && styles.tabItemActive]}
                                    onPress={() => setCurrentTab('Search')}
                                >
                                    <View style={currentTab === 'Search' ? styles.tabIconActive : styles.tabIcon}>
                                        <Search
                                            color={currentTab === 'Search' ? '#1a1a1a' : Colors.dark.textSecondary}
                                            size={22}
                                        />
                                    </View>
                                    <Text style={[styles.tabLabel, currentTab === 'Search' && styles.tabLabelActive]}>Search</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.tabItem, currentTab === 'Library' && styles.tabItemActive]}
                                    onPress={() => setCurrentTab('Library')}
                                >
                                    <View style={currentTab === 'Library' ? styles.tabIconActive : styles.tabIcon}>
                                        <FolderOpen
                                            color={currentTab === 'Library' ? '#1a1a1a' : Colors.dark.textSecondary}
                                            size={22}
                                        />
                                    </View>
                                    <Text style={[styles.tabLabel, currentTab === 'Library' && styles.tabLabelActive]}>Library</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </BlurView>
                </View>
            )}

        </View>
    );
};

const styles = StyleSheet.create({
    mainContainer: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    screenWrapper: {
        backgroundColor: Colors.dark.background,
        paddingTop: 0, // Override wrapper padding if needed
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 20,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        marginBottom: 16,
    },
    sectionTitle: {
        color: Colors.dark.text,
        fontSize: 16,
        fontWeight: '600',
        marginRight: 4,
    },
    newReleasedPreview: {
        height: 100,
        backgroundColor: '#333',
        marginHorizontal: 24,
        borderRadius: 12,
        opacity: 0.5,
    },
    footerContainer: {
        position: 'absolute',
        bottom: 20,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    footerBlur: {
        borderRadius: 32,
        overflow: 'hidden',
    },
    footerGradient: {
        backgroundColor: 'rgba(30, 30, 35, 0.9)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 32,
        // Shadow for floating effect
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
        elevation: 24,
    },
    tabBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 6,
        paddingHorizontal: 8,
        gap: 4,
    },
    tabItem: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
        paddingVertical: 4,
    },
    tabItemActive: {
        // No extra styles needed, handled by inner elements
    },
    tabIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tabIconActive: {
        width: 52,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
    },
    tabLabel: {
        fontSize: 10,
        color: Colors.dark.textSecondary,
        marginTop: 2,
        fontWeight: '500',
        letterSpacing: 0.2,
    },
    tabLabelActive: {
        color: '#fff',
        fontWeight: '600',
    },
});
