/**
 * Parallel Upload Manager - Client-side orchestration for 100 concurrent uploads
 *
 * This manager coordinates uploading 100 photos in parallel with the following optimizations:
 * 1. All 100 uploads start immediately (no queuing on client side)
 * 2. Each upload uses multipart for files > 10MB (parallel chunk uploads)
 * 3. Direct upload to S3 using presigned URLs (no server bandwidth)
 * 4. Real-time progress tracking for all uploads
 *
 * Performance Target: 100 photos (2MB each) in < 10 seconds
 *
 * Architecture:
 * - Client initiates 100 uploads simultaneously
 * - Server (Virtual Threads) handles all 100 init requests concurrently
 * - Client uploads all 100 files to S3 in parallel
 * - Each 2MB file completes in ~2 seconds (assuming 1MB/s network)
 * - With good network (10MB/s), all 100 files complete in ~2 seconds
 * - Total time: ~2-3 seconds for uploads + ~1 second for init/complete = 3-4 seconds
 */

/**
 * Generate a UUID v4
 * Fallback implementation for non-secure contexts where crypto.randomUUID() is not available
 */
function generateUUID(): string {
  // Try to use crypto.randomUUID() if available (secure context)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback for non-secure contexts (HTTP)
  // This generates a RFC4122 version 4 compliant UUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export interface UploadFile {
  file: File;
  id: string;
}

export interface UploadProgress {
  uploadId: string;
  filename: string;
  progress: number; // 0-100
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  error?: string;
  startTime?: number;
  endTime?: number;
}

export interface UploadInitResponse {
  uploadId: string;
  s3Key: string;
  multipartUploadId?: string;
  multipart: boolean;
  partSize?: number;
  numberOfParts?: number;
  presignedUrls: string[];
  expiresInMinutes: number;
}

export interface UploadCompleteRequest {
  uploadId: string;
  s3Key: string;
  filename: string;
  fileSizeBytes: number;
  contentType: string;
  multipartUploadId?: string;
  partETags: string[];
}

export class ParallelUploadManager {
  private apiBaseUrl: string;
  private uploads: Map<string, UploadProgress> = new Map();

  constructor(apiBaseUrl: string = '/api/v1/uploads') {
    this.apiBaseUrl = apiBaseUrl;
  }

  /**
   * Upload multiple files in parallel
   * This is the main entry point for uploading 100 photos
   *
   * @param files Array of files to upload (can be 100+)
   * @param onProgress Callback for progress updates
   * @returns Promise that resolves when ALL uploads complete
   */
  async uploadBatch(
    files: File[],
    onProgress?: (allProgress: UploadProgress[]) => void
  ): Promise<UploadProgress[]> {
    console.log(`Starting batch upload of ${files.length} files`);
    const startTime = performance.now();

    // Create upload tracking for each file
    const uploadFiles: UploadFile[] = files.map((file) => ({
      file,
      id: generateUUID(),
    }));

    // Initialize progress tracking
    uploadFiles.forEach(({ file, id }) => {
      this.uploads.set(id, {
        uploadId: '',
        filename: file.name,
        progress: 0,
        status: 'pending',
        startTime: Date.now(),
      });
    });

    // Upload ALL files in parallel (no artificial queuing)
    // Browser will handle connection pooling automatically
    const uploadPromises = uploadFiles.map((uploadFile) =>
      this.uploadSingleFile(uploadFile, (progress) => {
        // Update progress for this file
        this.uploads.set(uploadFile.id, progress);

        // Notify overall progress callback
        if (onProgress) {
          onProgress(Array.from(this.uploads.values()));
        }
      })
    );

    // Wait for ALL uploads to complete
    const results = await Promise.allSettled(uploadPromises);

    const endTime = performance.now();
    const totalTimeSeconds = ((endTime - startTime) / 1000).toFixed(2);

    console.log(`Batch upload completed in ${totalTimeSeconds}s`);
    console.log(`Success: ${results.filter((r) => r.status === 'fulfilled').length}/${files.length}`);
    console.log(`Failed: ${results.filter((r) => r.status === 'rejected').length}/${files.length}`);

    // Return final progress for all uploads
    return Array.from(this.uploads.values());
  }

  /**
   * Upload a single file with multipart support
   */
  private async uploadSingleFile(
    uploadFile: UploadFile,
    onProgress: (progress: UploadProgress) => void
  ): Promise<UploadProgress> {
    const { file } = uploadFile;

    try {
      // Step 1: Initialize upload - Get presigned URLs
      const initResponse = await this.initiateUpload(file);

      onProgress({
        uploadId: initResponse.uploadId,
        filename: file.name,
        progress: 0,
        status: 'uploading',
        startTime: Date.now(),
      });

      // Step 2: Upload to S3 using presigned URLs
      const partETags = await this.uploadToS3(
        file,
        initResponse,
        (progress) => {
          onProgress({
            uploadId: initResponse.uploadId,
            filename: file.name,
            progress,
            status: 'uploading',
            startTime: Date.now(),
          });
        }
      );

      // Step 3: Complete upload
      // CRITICAL: Pass ALL metadata (s3Key, filename, size, contentType, multipartUploadId)
      // This eliminates the need for backend to query database (fixes PostgreSQL snapshot issue)
      await this.completeUpload({
        uploadId: initResponse.uploadId,
        s3Key: initResponse.s3Key,
        filename: file.name,
        fileSizeBytes: file.size,
        contentType: file.type,
        multipartUploadId: initResponse.multipartUploadId,
        partETags,
      });

      const finalProgress: UploadProgress = {
        uploadId: initResponse.uploadId,
        filename: file.name,
        progress: 100,
        status: 'completed',
        startTime: Date.now(),
        endTime: Date.now(),
      };

      onProgress(finalProgress);
      return finalProgress;
    } catch (error) {
      const errorProgress: UploadProgress = {
        uploadId: '',
        filename: file.name,
        progress: 0,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Upload failed',
        startTime: Date.now(),
        endTime: Date.now(),
      };

      onProgress(errorProgress);
      throw error;
    }
  }

  /**
   * Step 1: Initialize upload with backend
   */
  private async initiateUpload(file: File): Promise<UploadInitResponse> {
    const response = await fetch(`${this.apiBaseUrl}/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filename: file.name,
        fileSizeBytes: file.size,
        contentType: file.type,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to initialize upload: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Step 2: Upload file to S3 using presigned URLs
   * Supports both single-part and multipart uploads
   */
  private async uploadToS3(
    file: File,
    initResponse: UploadInitResponse,
    onProgress: (progress: number) => void
  ): Promise<string[]> {
    if (!initResponse.multipart) {
      // Single-part upload for small files
      return [await this.uploadSinglePart(file, initResponse.presignedUrls[0], onProgress)];
    } else {
      // Multipart upload for large files
      return this.uploadMultipart(file, initResponse, onProgress);
    }
  }

  /**
   * Upload file as a single part (for small files < 10MB)
   */
  private async uploadSinglePart(
    file: File,
    presignedUrl: string,
    onProgress: (progress: number) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = (event.loaded / event.total) * 100;
          onProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const etag = xhr.getResponseHeader('ETag');
          if (etag) {
            resolve(etag.replace(/"/g, '')); // Remove quotes from ETag
          } else {
            reject(new Error('No ETag in response'));
          }
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
      xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

      xhr.open('PUT', presignedUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);
    });
  }

  /**
   * Upload file as multiple parts (for large files > 10MB)
   * All parts are uploaded in parallel for maximum speed
   */
  private async uploadMultipart(
    file: File,
    initResponse: UploadInitResponse,
    onProgress: (progress: number) => void
  ): Promise<string[]> {
    const { presignedUrls, partSize, numberOfParts } = initResponse;

    if (!partSize || !numberOfParts) {
      throw new Error('Invalid multipart upload response');
    }

    // Track progress for all parts
    const partProgress: number[] = new Array(numberOfParts).fill(0);

    const updateOverallProgress = () => {
      const totalProgress = partProgress.reduce((sum, p) => sum + p, 0) / numberOfParts;
      onProgress(totalProgress);
    };

    // Upload ALL parts in parallel
    const partUploadPromises = presignedUrls.map((presignedUrl, index) => {
      const start = index * partSize;
      const end = Math.min(start + partSize, file.size);
      const partBlob = file.slice(start, end);

      return this.uploadPart(partBlob, presignedUrl, (progress) => {
        partProgress[index] = progress;
        updateOverallProgress();
      });
    });

    // Wait for all parts to complete
    const eTags = await Promise.all(partUploadPromises);

    return eTags;
  }

  /**
   * Upload a single part of a multipart upload
   */
  private async uploadPart(
    partBlob: Blob,
    presignedUrl: string,
    onProgress: (progress: number) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = (event.loaded / event.total) * 100;
          onProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const etag = xhr.getResponseHeader('ETag');
          if (etag) {
            resolve(etag.replace(/"/g, ''));
          } else {
            reject(new Error('No ETag in response'));
          }
        } else {
          reject(new Error(`Part upload failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Network error during part upload')));

      xhr.open('PUT', presignedUrl);
      xhr.send(partBlob);
    });
  }

  /**
   * Step 3: Complete the upload
   */
  private async completeUpload(request: UploadCompleteRequest): Promise<void> {
    const response = await fetch(`${this.apiBaseUrl}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Failed to complete upload: ${response.statusText}`);
    }
  }

  /**
   * Get current progress for all uploads
   */
  getAllProgress(): UploadProgress[] {
    return Array.from(this.uploads.values());
  }

  /**
   * Clear completed uploads from tracking
   */
  clearCompleted(): void {
    for (const [id, progress] of this.uploads.entries()) {
      if (progress.status === 'completed' || progress.status === 'failed') {
        this.uploads.delete(id);
      }
    }
  }
}
