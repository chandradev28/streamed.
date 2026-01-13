import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';

interface ScreenWrapperProps {
    children: React.ReactNode;
    style?: any;
}

export const ScreenWrapper: React.FC<ScreenWrapperProps> = ({ children, style }) => {
    return (
        <SafeAreaView style={[styles.container, style]} edges={['top', 'left', 'right']}>
            <View style={styles.content}>
                {children}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.light.background,
    },
    content: {
        flex: 1,
    },
});
