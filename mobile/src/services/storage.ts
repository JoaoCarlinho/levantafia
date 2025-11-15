import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UploadQueueItem } from '../types';

/**
 * Storage keys
 */
const STORAGE_KEYS = {
  UPLOAD_QUEUE: '@levantafia:upload_queue',
  PHOTOS_CACHE: '@levantafia:photos_cache',
} as const;

/**
 * Upload Queue Storage Service
 */
export class UploadQueueStorage {
  /**
   * Get all items in the upload queue
   */
  static async getQueue(): Promise<UploadQueueItem[]> {
    try {
      const queueJson = await AsyncStorage.getItem(STORAGE_KEYS.UPLOAD_QUEUE);
      if (!queueJson) {
        return [];
      }
      return JSON.parse(queueJson) as UploadQueueItem[];
    } catch (error) {
      console.error('Failed to get upload queue:', error);
      return [];
    }
  }

  /**
   * Save the entire upload queue
   */
  static async saveQueue(queue: UploadQueueItem[]): Promise<void> {
    try {
      const queueJson = JSON.stringify(queue);
      await AsyncStorage.setItem(STORAGE_KEYS.UPLOAD_QUEUE, queueJson);
    } catch (error) {
      console.error('Failed to save upload queue:', error);
      throw error;
    }
  }

  /**
   * Add an item to the upload queue
   */
  static async addToQueue(item: UploadQueueItem): Promise<void> {
    try {
      const queue = await this.getQueue();
      queue.push(item);
      await this.saveQueue(queue);
    } catch (error) {
      console.error('Failed to add to upload queue:', error);
      throw error;
    }
  }

  /**
   * Update an item in the upload queue
   */
  static async updateQueueItem(queueId: string, updates: Partial<UploadQueueItem>): Promise<void> {
    try {
      const queue = await this.getQueue();
      const index = queue.findIndex(item => item.queueId === queueId);

      if (index !== -1) {
        queue[index] = { ...queue[index], ...updates };
        await this.saveQueue(queue);
      }
    } catch (error) {
      console.error('Failed to update queue item:', error);
      throw error;
    }
  }

  /**
   * Remove an item from the upload queue
   */
  static async removeFromQueue(queueId: string): Promise<void> {
    try {
      const queue = await this.getQueue();
      const filteredQueue = queue.filter(item => item.queueId !== queueId);
      await this.saveQueue(filteredQueue);
    } catch (error) {
      console.error('Failed to remove from upload queue:', error);
      throw error;
    }
  }

  /**
   * Clear all completed uploads from the queue
   */
  static async clearCompleted(): Promise<void> {
    try {
      const queue = await this.getQueue();
      const activeQueue = queue.filter(item => item.status !== 'completed');
      await this.saveQueue(activeQueue);
    } catch (error) {
      console.error('Failed to clear completed items:', error);
      throw error;
    }
  }

  /**
   * Clear the entire upload queue
   */
  static async clearQueue(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.UPLOAD_QUEUE);
    } catch (error) {
      console.error('Failed to clear upload queue:', error);
      throw error;
    }
  }
}

/**
 * Photos Cache Storage Service
 */
export class PhotosCacheStorage {
  /**
   * Get cached photos
   */
  static async getCachedPhotos(): Promise<any[]> {
    try {
      const cacheJson = await AsyncStorage.getItem(STORAGE_KEYS.PHOTOS_CACHE);
      if (!cacheJson) {
        return [];
      }
      return JSON.parse(cacheJson);
    } catch (error) {
      console.error('Failed to get cached photos:', error);
      return [];
    }
  }

  /**
   * Save photos to cache
   */
  static async cachePhotos(photos: any[]): Promise<void> {
    try {
      const cacheJson = JSON.stringify(photos);
      await AsyncStorage.setItem(STORAGE_KEYS.PHOTOS_CACHE, cacheJson);
    } catch (error) {
      console.error('Failed to cache photos:', error);
      throw error;
    }
  }

  /**
   * Clear photos cache
   */
  static async clearCache(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.PHOTOS_CACHE);
    } catch (error) {
      console.error('Failed to clear photos cache:', error);
      throw error;
    }
  }
}

/**
 * General storage utilities
 */
export class StorageUtils {
  /**
   * Clear all app data
   */
  static async clearAll(): Promise<void> {
    try {
      await AsyncStorage.clear();
    } catch (error) {
      console.error('Failed to clear all storage:', error);
      throw error;
    }
  }

  /**
   * Get storage size estimate
   */
  static async getStorageSize(): Promise<number> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      let totalSize = 0;

      for (const key of keys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          totalSize += value.length;
        }
      }

      return totalSize;
    } catch (error) {
      console.error('Failed to get storage size:', error);
      return 0;
    }
  }
}
