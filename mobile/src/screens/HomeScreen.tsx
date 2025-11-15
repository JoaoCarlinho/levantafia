import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export const HomeScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Levantafia</Text>
      <Text style={styles.subtitle}>Photo Upload Mobile App</Text>

      <View style={styles.placeholderContainer}>
        <Text style={styles.placeholderText}>
          Welcome to Levantafia Mobile!
        </Text>
        <Text style={styles.description}>
          This is the foundation for the mobile app. The following features will be implemented:
        </Text>

        <View style={styles.featureList}>
          <Text style={styles.featureItem}>📸 Camera & Photo Library Access</Text>
          <Text style={styles.featureItem}>⬆️ Batch Photo Upload</Text>
          <Text style={styles.featureItem}>🖼️ Photo Gallery</Text>
          <Text style={styles.featureItem}>🗑️ Photo Management (Delete)</Text>
          <Text style={styles.featureItem}>📶 Offline Queue Support</Text>
          <Text style={styles.featureItem}>⚡ Real-time Upload Progress</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888888',
    textAlign: 'center',
    marginBottom: 40,
  },
  placeholderContainer: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 24,
  },
  placeholderText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#60a5fa',
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: '#cccccc',
    marginBottom: 20,
    lineHeight: 20,
  },
  featureList: {
    gap: 12,
  },
  featureItem: {
    fontSize: 16,
    color: '#ffffff',
    lineHeight: 24,
  },
});
