import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
  Alert,
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { apiClient } from '../services/api';
import { PhotosCacheStorage } from '../services/storage';
import type { Photo } from '../types';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 2;
const SPACING = 12;
const ITEM_SIZE = (width - SPACING * (COLUMN_COUNT + 1)) / COLUMN_COUNT;

export const GalleryScreen: React.FC = () => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const isFocused = useIsFocused();

  // Load photos on initial mount
  useEffect(() => {
    loadPhotos();
  }, []);

  // Reload photos when screen comes into focus (e.g., after uploading)
  useEffect(() => {
    if (isFocused) {
      loadPhotos(false); // Skip cache to get fresh data
    }
  }, [isFocused]);

  const loadPhotos = async (useCache = true) => {
    try {
      // Try to load from cache first
      if (useCache) {
        const cached = await PhotosCacheStorage.getCachedPhotos();
        if (cached.length > 0) {
          setPhotos(cached);
          setLoading(false);
        }
      }

      // Fetch fresh data from API
      const freshPhotos = await apiClient.getPhotos();
      setPhotos(freshPhotos);

      // Update cache
      await PhotosCacheStorage.cachePhotos(freshPhotos);
    } catch (error) {
      console.error('Failed to load photos:', error);
      Alert.alert('Error', 'Failed to load photos. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPhotos(false);
  }, []);

  const toggleSelection = (photoId: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(photoId)) {
      newSelection.delete(photoId);
    } else {
      newSelection.add(photoId);
    }
    setSelectedIds(newSelection);

    if (newSelection.size === 0) {
      setSelectionMode(false);
    }
  };

  const handleLongPress = (photoId: string) => {
    setSelectionMode(true);
    toggleSelection(photoId);
  };

  const selectAll = () => {
    setSelectedIds(new Set(photos.map(p => p.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  };

  const cleanupStuckUploads = async () => {
    Alert.alert(
      'Clean Up Stuck Uploads',
      'This will delete upload jobs stuck in pending state for more than 1 hour. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clean Up',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await apiClient.cleanupStuckUploads();
              Alert.alert(
                'Success',
                `${result.deletedCount} stuck upload jobs deleted.`
              );
              loadPhotos(false); // Refresh gallery
            } catch (error) {
              console.error('Failed to cleanup stuck uploads:', error);
              Alert.alert('Error', 'Failed to cleanup stuck uploads.');
            }
          },
        },
      ]
    );
  };

  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;

    Alert.alert(
      'Delete Photos',
      `Are you sure you want to delete ${selectedIds.size} photo(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.deletePhotos(Array.from(selectedIds));

              // Optimistic update
              setPhotos(prev => prev.filter(p => !selectedIds.has(p.id)));
              setSelectedIds(new Set());
              setSelectionMode(false);

              // Update cache
              const updatedPhotos = photos.filter(p => !selectedIds.has(p.id));
              await PhotosCacheStorage.cachePhotos(updatedPhotos);
            } catch (error) {
              console.error('Failed to delete photos:', error);
              Alert.alert('Error', 'Failed to delete photos. Please try again.');
              // Reload to sync state
              loadPhotos(false);
            }
          },
        },
      ]
    );
  };

  const renderPhoto = ({ item }: { item: Photo }) => {
    const isSelected = selectedIds.has(item.id);

    return (
      <TouchableOpacity
        style={[
          styles.photoCard,
          isSelected && styles.photoCardSelected,
        ]}
        onPress={() => {
          if (selectionMode) {
            toggleSelection(item.id);
          }
        }}
        onLongPress={() => handleLongPress(item.id)}
        activeOpacity={0.7}
      >
        <Image
          source={{ uri: item.url }}
          style={styles.photoImage}
          resizeMode="cover"
        />
        {selectionMode && (
          <View style={styles.selectionOverlay}>
            <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
              {isSelected && <Text style={styles.checkmark}>✓</Text>}
            </View>
          </View>
        )}
        <View style={styles.photoInfo}>
          <Text style={styles.photoFilename} numberOfLines={1}>
            {item.filename}
          </Text>
          <Text style={styles.photoMeta}>
            {(item.sizeBytes / 1024 / 1024).toFixed(2)} MB
            {item.width > 0 && ` • ${item.width}×${item.height}`}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && photos.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>Loading photos...</Text>
      </View>
    );
  }

  if (photos.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>No photos yet</Text>
        <Text style={styles.emptySubtext}>Upload some photos to get started!</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!selectionMode && (
        <View style={styles.toolbarHeader}>
          <TouchableOpacity
            onPress={cleanupStuckUploads}
            style={styles.cleanupButton}
          >
            <Text style={styles.cleanupButtonText}>Clean Up Stuck Uploads</Text>
          </TouchableOpacity>
        </View>
      )}

      {selectionMode && (
        <View style={styles.selectionHeader}>
          <Text style={styles.selectionCount}>
            {selectedIds.size} selected
          </Text>
          <View style={styles.selectionActions}>
            <TouchableOpacity onPress={selectAll} style={styles.actionButton}>
              <Text style={styles.actionButtonText}>Select All</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={deselectAll} style={styles.actionButton}>
              <Text style={styles.actionButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={deleteSelected}
              style={[styles.actionButton, styles.deleteButton]}
              disabled={selectedIds.size === 0}
            >
              <Text style={[styles.actionButtonText, styles.deleteButtonText]}>
                Delete ({selectedIds.size})
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <FlatList
        data={photos}
        renderItem={renderPhoto}
        keyExtractor={(item) => item.id}
        numColumns={COLUMN_COUNT}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#60a5fa"
          />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  toolbarHeader: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    backgroundColor: '#1f1f1f',
  },
  cleanupButton: {
    backgroundColor: '#ea580c',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cleanupButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  list: {
    padding: SPACING,
  },
  photoCard: {
    width: ITEM_SIZE,
    marginBottom: SPACING,
    marginHorizontal: SPACING / 2,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  photoCardSelected: {
    borderColor: '#60a5fa',
  },
  photoImage: {
    width: '100%',
    height: ITEM_SIZE,
  },
  selectionOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ffffff',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#60a5fa',
    borderColor: '#60a5fa',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  photoInfo: {
    padding: 8,
  },
  photoFilename: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  photoMeta: {
    color: '#888888',
    fontSize: 10,
  },
  emptyText: {
    color: '#888888',
    fontSize: 18,
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#666666',
    fontSize: 14,
  },
  selectionHeader: {
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  selectionCount: {
    color: '#60a5fa',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  selectionActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#333333',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
  },
  deleteButton: {
    backgroundColor: '#ef4444',
  },
  deleteButtonText: {
    color: '#ffffff',
  },
});
