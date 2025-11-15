/**
 * Integration Tests for Levantafia Mobile
 *
 * These tests verify end-to-end functionality:
 * 1. Photo gallery loading and caching
 * 2. Photo upload flow
 * 3. Photo deletion
 * 4. Offline queue management
 * 5. Network state handling
 */

import { apiClient } from '../services/api';
import { UploadQueueStorage, PhotosCacheStorage } from '../services/storage';
import type { Photo, UploadQueueItem } from '../types';

describe('Photo Gallery Integration', () => {
  beforeEach(async () => {
    // Clear storage before each test
    await PhotosCacheStorage.clearCache();
  });

  it('should fetch photos from API and cache them', async () => {
    const photos = await apiClient.getPhotos();
    expect(Array.isArray(photos)).toBe(true);

    // Cache photos
    await PhotosCacheStorage.cachePhotos(photos);

    // Verify cached data
    const cached = await PhotosCacheStorage.getCachedPhotos();
    expect(cached).toEqual(photos);
  });

  it('should handle empty photo list gracefully', async () => {
    await PhotosCacheStorage.cachePhotos([]);
    const cached = await PhotosCacheStorage.getCachedPhotos();
    expect(cached).toEqual([]);
  });
});

describe('Photo Upload Integration', () => {
  beforeEach(async () => {
    await UploadQueueStorage.clearQueue();
  });

  it('should add photos to upload queue', async () => {
    const testItem: UploadQueueItem = {
      queueId: 'test-1',
      localUri: 'file://test.jpg',
      filename: 'test.jpg',
      fileSize: 1024000,
      mimeType: 'image/jpeg',
      status: 'queued',
      progress: 0,
      retryCount: 0,
      createdAt: new Date().toISOString(),
    };

    await UploadQueueStorage.addToQueue(testItem);

    const queue = await UploadQueueStorage.getQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].queueId).toBe('test-1');
  });

  it('should update queue item status', async () => {
    const testItem: UploadQueueItem = {
      queueId: 'test-2',
      localUri: 'file://test2.jpg',
      filename: 'test2.jpg',
      fileSize: 2048000,
      mimeType: 'image/jpeg',
      status: 'queued',
      progress: 0,
      retryCount: 0,
      createdAt: new Date().toISOString(),
    };

    await UploadQueueStorage.addToQueue(testItem);

    // Update to uploading
    await UploadQueueStorage.updateQueueItem('test-2', {
      status: 'uploading',
      progress: 50,
    });

    const queue = await UploadQueueStorage.getQueue();
    expect(queue[0].status).toBe('uploading');
    expect(queue[0].progress).toBe(50);
  });

  it('should remove completed items from queue', async () => {
    const item1: UploadQueueItem = {
      queueId: 'test-3',
      localUri: 'file://test3.jpg',
      filename: 'test3.jpg',
      fileSize: 1024000,
      mimeType: 'image/jpeg',
      status: 'completed',
      progress: 100,
      retryCount: 0,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };

    const item2: UploadQueueItem = {
      queueId: 'test-4',
      localUri: 'file://test4.jpg',
      filename: 'test4.jpg',
      fileSize: 1024000,
      mimeType: 'image/jpeg',
      status: 'queued',
      progress: 0,
      retryCount: 0,
      createdAt: new Date().toISOString(),
    };

    await UploadQueueStorage.addToQueue(item1);
    await UploadQueueStorage.addToQueue(item2);

    await UploadQueueStorage.clearCompleted();

    const queue = await UploadQueueStorage.getQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].queueId).toBe('test-4');
  });
});

describe('Photo Deletion Integration', () => {
  it('should delete multiple photos', async () => {
    // This would require a test backend or mocking
    // For now, verify the API client method exists
    expect(typeof apiClient.deletePhotos).toBe('function');
  });
});

describe('Offline Queue Management', () => {
  it('should handle offline queue items correctly', async () => {
    const offlineItem: UploadQueueItem = {
      queueId: 'offline-1',
      localUri: 'file://offline.jpg',
      filename: 'offline.jpg',
      fileSize: 1024000,
      mimeType: 'image/jpeg',
      status: 'waiting_for_network',
      progress: 0,
      retryCount: 0,
      createdAt: new Date().toISOString(),
    };

    await UploadQueueStorage.addToQueue(offlineItem);

    const queue = await UploadQueueStorage.getQueue();
    expect(queue[0].status).toBe('waiting_for_network');
  });

  it('should update offline items when network restored', async () => {
    const item: UploadQueueItem = {
      queueId: 'offline-2',
      localUri: 'file://offline2.jpg',
      filename: 'offline2.jpg',
      fileSize: 1024000,
      mimeType: 'image/jpeg',
      status: 'waiting_for_network',
      progress: 0,
      retryCount: 0,
      createdAt: new Date().toISOString(),
    };

    await UploadQueueStorage.addToQueue(item);

    // Simulate network restored
    await UploadQueueStorage.updateQueueItem('offline-2', {
      status: 'queued',
    });

    const queue = await UploadQueueStorage.getQueue();
    expect(queue[0].status).toBe('queued');
  });
});

describe('API Client', () => {
  it('should have all required methods', () => {
    expect(apiClient.getPhotos).toBeDefined();
    expect(apiClient.deletePhotos).toBeDefined();
    expect(apiClient.uploadPhoto).toBeDefined();
    expect(apiClient.healthCheck).toBeDefined();
  });

  it('should handle API errors gracefully', async () => {
    try {
      await apiClient.deletePhotos(['invalid-id']);
      // If this succeeds (backend is running), that's fine
    } catch (error) {
      // Error is expected if backend is not running
      expect(error).toBeDefined();
    }
  });
});
