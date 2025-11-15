/**
 * Core type definitions for Levantafia Mobile
 */

/**
 * Photo entity from backend
 */
export interface Photo {
  id: string;              // UUID from backend
  filename: string;        // Original filename (e.g., "IMG_1234.jpg")
  url: string;             // CloudFront URL
  sizeBytes: number;       // Size in bytes
  width: number;           // Image width in pixels
  height: number;          // Image height in pixels
  createdAt: string;       // ISO 8601 timestamp
  uploadComplete?: boolean; // Flag for newly uploaded photos
}

/**
 * Upload status enum
 */
export enum UploadStatus {
  QUEUED = 'queued',
  COMPRESSING = 'compressing',
  UPLOADING = 'uploading',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  WAITING_FOR_NETWORK = 'waiting_for_network'
}

/**
 * Upload queue item for offline queue management
 */
export interface UploadQueueItem {
  queueId: string;           // Client-generated UUID
  localUri: string;          // Local device file URI
  filename: string;          // Original filename
  fileSize: number;          // Size in bytes
  mimeType: string;          // Image MIME type
  status: UploadStatus;      // Current upload status
  progress: number;          // Upload progress 0-100
  uploadSpeed?: number;      // Current upload speed (bytes/sec)
  error?: string;            // Error message if failed
  retryCount: number;        // Number of retry attempts
  createdAt: string;         // ISO 8601 timestamp
  startedAt?: string;        // Upload start timestamp
  completedAt?: string;      // Upload completion timestamp
  photoId?: string;          // Backend photo ID after successful upload
}

/**
 * API response types
 */
export interface DeletePhotosResponse {
  deletedCount: number;
  failedCount?: number;
}

export interface UploadResponse {
  uploadId: string;
  photo: Photo;
  cdnUrl: string;
}

/**
 * Network state
 */
export interface NetworkState {
  isConnected: boolean;
  type: string | null;
  isInternetReachable: boolean | null;
}
