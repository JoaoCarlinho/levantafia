import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import NetInfo from '@react-native-community/netinfo';
import { apiClient } from '../services/api';
import { UploadQueueStorage } from '../services/storage';
import type { UploadQueueItem, UploadStatus, NetworkState } from '../types';

export const UploadScreen: React.FC = () => {
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [networkState, setNetworkState] = useState<NetworkState>({
    isConnected: true,
    type: null,
    isInternetReachable: true,
  });

  useEffect(() => {
    loadQueue();
    setupNetworkListener();
  }, []);

  const setupNetworkListener = () => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setNetworkState({
        isConnected: state.isConnected ?? false,
        type: state.type,
        isInternetReachable: state.isInternetReachable ?? null,
      });

      // Auto-resume uploads when connection restored
      if (state.isConnected && state.isInternetReachable) {
        processQueue();
      }
    });

    return unsubscribe;
  };

  const loadQueue = async () => {
    const queue = await UploadQueueStorage.getQueue();
    setUploadQueue(queue);
  };

  const pickImages = async (useCamera: boolean = false) => {
    try {
      const { status } = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera/photo library access to upload photos.');
        return;
      }

      const result = useCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.8,
            allowsEditing: false,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.8,
            allowsMultipleSelection: true,
            selectionLimit: 100,
          });

      if (!result.canceled && result.assets) {
        await addToQueue(result.assets);
      }
    } catch (error) {
      console.error('Failed to pick images:', error);
      Alert.alert('Error', 'Failed to pick images. Please try again.');
    }
  };

  const addToQueue = async (assets: ImagePicker.ImagePickerAsset[]) => {
    const newItems: UploadQueueItem[] = assets.map(asset => ({
      queueId: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      localUri: asset.uri,
      filename: asset.uri.split('/').pop() || 'photo.jpg',
      fileSize: asset.fileSize || 0,
      mimeType: asset.mimeType || 'image/jpeg',
      status: (networkState.isConnected ? 'queued' : 'waiting_for_network') as UploadStatus,
      progress: 0,
      retryCount: 0,
      createdAt: new Date().toISOString(),
    }));

    for (const item of newItems) {
      await UploadQueueStorage.addToQueue(item);
    }

    setUploadQueue(prev => [...prev, ...newItems]);

    // Start uploading if online
    if (networkState.isConnected) {
      processQueue();
    }
  };

  const processQueue = async () => {
    if (isUploading) return;

    const queue = await UploadQueueStorage.getQueue();
    const pending = queue.filter(
      item => item.status === 'queued' || item.status === 'waiting_for_network'
    );

    if (pending.length === 0) return;

    setIsUploading(true);

    // Process up to 3 concurrent uploads
    const MAX_CONCURRENT = 3;
    for (let i = 0; i < pending.length; i += MAX_CONCURRENT) {
      const batch = pending.slice(i, i + MAX_CONCURRENT);
      await Promise.all(batch.map(item => uploadPhoto(item)));
    }

    setIsUploading(false);
  };

  const uploadPhoto = async (item: UploadQueueItem) => {
    try {
      // Update status to uploading
      await UploadQueueStorage.updateQueueItem(item.queueId, {
        status: 'uploading' as UploadStatus,
        startedAt: new Date().toISOString(),
      });

      setUploadQueue(prev =>
        prev.map(q =>
          q.queueId === item.queueId
            ? { ...q, status: 'uploading' as UploadStatus }
            : q
        )
      );

      // Upload to backend
      const response = await apiClient.uploadPhoto(
        item.localUri,
        item.filename,
        item.mimeType,
        (progress) => {
          setUploadQueue(prev =>
            prev.map(q =>
              q.queueId === item.queueId ? { ...q, progress } : q
            )
          );
        }
      );

      // Mark as completed
      await UploadQueueStorage.updateQueueItem(item.queueId, {
        status: 'completed' as UploadStatus,
        progress: 100,
        completedAt: new Date().toISOString(),
        photoId: response.photo?.id,
      });

      setUploadQueue(prev =>
        prev.map(q =>
          q.queueId === item.queueId
            ? { ...q, status: 'completed' as UploadStatus, progress: 100 }
            : q
        )
      );
    } catch (error) {
      console.error('Upload failed:', error);

      const newRetryCount = item.retryCount + 1;
      const maxRetries = 3;

      if (newRetryCount < maxRetries && networkState.isConnected) {
        // Retry
        await UploadQueueStorage.updateQueueItem(item.queueId, {
          retryCount: newRetryCount,
          status: 'queued' as UploadStatus,
        });

        setTimeout(() => uploadPhoto({ ...item, retryCount: newRetryCount }), 2000);
      } else {
        // Mark as failed
        await UploadQueueStorage.updateQueueItem(item.queueId, {
          status: 'failed' as UploadStatus,
          error: error instanceof Error ? error.message : 'Upload failed',
        });

        setUploadQueue(prev =>
          prev.map(q =>
            q.queueId === item.queueId
              ? { ...q, status: 'failed' as UploadStatus }
              : q
          )
        );
      }
    }
  };

  const retryFailed = async () => {
    const failed = uploadQueue.filter(item => item.status === 'failed');
    for (const item of failed) {
      await UploadQueueStorage.updateQueueItem(item.queueId, {
        status: 'queued' as UploadStatus,
        retryCount: 0,
      });
    }
    loadQueue();
    processQueue();
  };

  const clearCompleted = async () => {
    await UploadQueueStorage.clearCompleted();
    loadQueue();
  };

  const clearPending = async () => {
    Alert.alert(
      'Clear Stuck Uploads',
      'This will remove all queued, waiting, and uploading items from the list. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            const currentQueue = await UploadQueueStorage.getQueue();

            // Remove items that are queued, waiting for network, or currently uploading
            const itemsToRemove = currentQueue.filter(item =>
              item.status === 'queued' ||
              item.status === 'waiting_for_network' ||
              item.status === 'uploading'
            );

            for (const item of itemsToRemove) {
              await UploadQueueStorage.removeFromQueue(item.queueId);
            }

            loadQueue();
            Alert.alert('Success', `Cleared ${itemsToRemove.length} stuck upload(s)`);
          },
        },
      ]
    );
  };

  const renderUploadItem = ({ item }: { item: UploadQueueItem }) => {
    const getStatusColor = () => {
      switch (item.status) {
        case 'completed':
          return '#22c55e';
        case 'failed':
          return '#ef4444';
        case 'uploading':
          return '#60a5fa';
        default:
          return '#888888';
      }
    };

    const getStatusText = () => {
      switch (item.status) {
        case 'completed':
          return 'Uploaded';
        case 'failed':
          return 'Failed';
        case 'uploading':
          return `Uploading ${item.progress}%`;
        case 'waiting_for_network':
          return 'Waiting for network';
        default:
          return 'Queued';
      }
    };

    return (
      <View style={styles.uploadItem}>
        <Image source={{ uri: item.localUri }} style={styles.thumbnail} />
        <View style={styles.uploadInfo}>
          <Text style={styles.uploadFilename} numberOfLines={1}>
            {item.filename}
          </Text>
          <Text style={[styles.uploadStatus, { color: getStatusColor() }]}>
            {getStatusText()}
          </Text>
          {item.status === 'uploading' && (
            <View style={styles.progressBar}>
              <View
                style={[styles.progressFill, { width: `${item.progress}%` }]}
              />
            </View>
          )}
        </View>
      </View>
    );
  };

  const pendingCount = uploadQueue.filter(
    item => item.status === 'queued' || item.status === 'uploading' || item.status === 'waiting_for_network'
  ).length;
  const failedCount = uploadQueue.filter(item => item.status === 'failed').length;
  const completedCount = uploadQueue.filter(item => item.status === 'completed').length;

  return (
    <View style={styles.container}>
      {!networkState.isConnected && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>
            Offline - Photos will upload when connection is restored
          </Text>
        </View>
      )}

      <View style={styles.header}>
        <Text style={styles.title}>Upload Photos</Text>
        <View style={styles.stats}>
          <Text style={styles.stat}>
            Pending: {pendingCount}
          </Text>
          <Text style={styles.stat}>
            Completed: {completedCount}
          </Text>
          {failedCount > 0 && (
            <Text style={[styles.stat, styles.failedStat]}>
              Failed: {failedCount}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => pickImages(false)}
        >
          <Text style={styles.primaryButtonText}>Choose from Library</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => pickImages(true)}
        >
          <Text style={styles.secondaryButtonText}>Take Photo</Text>
        </TouchableOpacity>
      </View>

      {uploadQueue.length > 0 && (
        <>
          <View style={styles.queueActions}>
            {pendingCount > 0 && (
              <TouchableOpacity onPress={clearPending} style={[styles.actionBtn, styles.warningBtn]}>
                <Text style={styles.actionBtnText}>Clear Stuck ({pendingCount})</Text>
              </TouchableOpacity>
            )}
            {failedCount > 0 && (
              <TouchableOpacity onPress={retryFailed} style={styles.actionBtn}>
                <Text style={styles.actionBtnText}>Retry Failed</Text>
              </TouchableOpacity>
            )}
            {completedCount > 0 && (
              <TouchableOpacity onPress={clearCompleted} style={styles.actionBtn}>
                <Text style={styles.actionBtnText}>Clear Completed</Text>
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            data={uploadQueue}
            renderItem={renderUploadItem}
            keyExtractor={(item) => item.queueId}
            style={styles.list}
          />
        </>
      )}

      {uploadQueue.length === 0 && (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No photos in upload queue</Text>
          <Text style={styles.emptySubtext}>
            Choose photos from your library or take a new photo
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  offlineBanner: {
    backgroundColor: '#ea580c',
    padding: 12,
  },
  offlineText: {
    color: '#ffffff',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  title: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  stats: {
    flexDirection: 'row',
    gap: 16,
  },
  stat: {
    color: '#888888',
    fontSize: 14,
  },
  failedStat: {
    color: '#ef4444',
  },
  actions: {
    padding: 16,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#60a5fa',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#2a2a2a',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#60a5fa',
  },
  secondaryButtonText: {
    color: '#60a5fa',
    fontSize: 16,
    fontWeight: '600',
  },
  queueActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  actionBtn: {
    backgroundColor: '#333333',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  warningBtn: {
    backgroundColor: '#ea580c',
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 14,
  },
  list: {
    flex: 1,
  },
  uploadItem: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    alignItems: 'center',
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  uploadInfo: {
    flex: 1,
  },
  uploadFilename: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  uploadStatus: {
    fontSize: 12,
    marginBottom: 4,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#333333',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#60a5fa',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    color: '#888888',
    fontSize: 18,
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#666666',
    fontSize: 14,
    textAlign: 'center',
  },
});
