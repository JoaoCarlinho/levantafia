import axios, { AxiosInstance, AxiosError } from 'axios';
import { API_BASE_URL, API_ENDPOINTS, API_TIMEOUT } from '../constants/api';
import type { Photo, DeletePhotosResponse, UploadResponse } from '../types';

/**
 * API Client for Levantafia Backend
 */
class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: API_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        console.error('API Error:', error.message);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get all photos
   */
  async getPhotos(): Promise<Photo[]> {
    try {
      const response = await this.client.get<Photo[]>(API_ENDPOINTS.PHOTOS);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch photos:', error);
      throw error;
    }
  }

  /**
   * Delete multiple photos
   */
  async deletePhotos(photoIds: string[]): Promise<DeletePhotosResponse> {
    try {
      const response = await this.client.delete<DeletePhotosResponse>(
        API_ENDPOINTS.DELETE_PHOTOS,
        {
          data: { photoIds },
        }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to delete photos:', error);
      throw error;
    }
  }

  /**
   * Upload a photo
   */
  async uploadPhoto(
    fileUri: string,
    filename: string,
    mimeType: string,
    onProgress?: (progress: number) => void
  ): Promise<UploadResponse> {
    try {
      const formData = new FormData();

      // Create file object for upload
      const file = {
        uri: fileUri,
        type: mimeType,
        name: filename,
      } as any;

      formData.append('file', file);

      const response = await this.client.post<UploadResponse>(
        API_ENDPOINTS.UPLOAD,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            if (onProgress && progressEvent.total) {
              const percentCompleted = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total
              );
              onProgress(percentCompleted);
            }
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('Failed to upload photo:', error);
      throw error;
    }
  }

  /**
   * Check server health
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/actuator/health', {
        timeout: 5000,
      });
      return response.status === 200;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
