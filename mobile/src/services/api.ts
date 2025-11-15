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
   * Upload a photo using the multipart upload workflow
   */
  async uploadPhoto(
    fileUri: string,
    filename: string,
    mimeType: string,
    onProgress?: (progress: number) => void
  ): Promise<UploadResponse> {
    try {
      // Get file size first
      const fileInfo = await fetch(fileUri);
      const blob = await fileInfo.blob();
      const fileSizeBytes = blob.size;

      // Step 1: Initialize upload to get presigned URLs
      const initResponse = await this.client.post(API_ENDPOINTS.UPLOAD_INIT, {
        filename,
        fileSizeBytes,
        contentType: mimeType,
      });

      const {
        uploadId,
        s3Key,
        multipartUploadId,
        presignedUrls,
        multipart,
      } = initResponse.data;

      if (onProgress) onProgress(10);

      // Step 2: Upload directly to S3 using presigned URLs
      const partETags: string[] = [];

      if (multipart && presignedUrls && presignedUrls.length > 0) {
        // Multipart upload
        const chunkSize = Math.ceil(fileSizeBytes / presignedUrls.length);

        for (let i = 0; i < presignedUrls.length; i++) {
          const start = i * chunkSize;
          const end = Math.min(start + chunkSize, fileSizeBytes);
          const chunk = blob.slice(start, end);

          const uploadResponse = await fetch(presignedUrls[i], {
            method: 'PUT',
            body: chunk,
            headers: {
              'Content-Type': mimeType,
            },
          });

          const etag = uploadResponse.headers.get('ETag')?.replace(/"/g, '') || '';
          partETags.push(etag);

          if (onProgress) {
            const progress = 10 + Math.round((i + 1) / presignedUrls.length * 80);
            onProgress(progress);
          }
        }
      } else if (presignedUrls && presignedUrls.length === 1) {
        // Single-part upload
        const uploadResponse = await fetch(presignedUrls[0], {
          method: 'PUT',
          body: blob,
          headers: {
            'Content-Type': mimeType,
          },
        });

        const etag = uploadResponse.headers.get('ETag')?.replace(/"/g, '') || '';
        partETags.push(etag);

        if (onProgress) onProgress(90);
      }

      // Step 3: Complete the upload
      const completeResponse = await this.client.post(API_ENDPOINTS.UPLOAD_COMPLETE, {
        uploadId,
        s3Key,
        filename,
        fileSizeBytes,
        contentType: mimeType,
        multipartUploadId: multipart ? multipartUploadId : null,
        partETags,
      });

      if (onProgress) onProgress(100);

      return {
        photo: {
          id: completeResponse.data.photoId,
          url: completeResponse.data.cdnUrl,
          thumbnailUrl: completeResponse.data.cdnUrl,
          filename: completeResponse.data.filename,
          uploadedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('Failed to upload photo:', error);
      throw error;
    }
  }

  /**
   * Clean up stuck upload jobs (INITIATED or UPLOADING for > 1 hour)
   */
  async cleanupStuckUploads(): Promise<{ deletedCount: number; message: string }> {
    try {
      const response = await this.client.delete(API_ENDPOINTS.CLEANUP_STUCK_UPLOADS);
      return response.data;
    } catch (error) {
      console.error('Failed to cleanup stuck uploads:', error);
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
