import React, { useState, useRef } from 'react';
import { ParallelUploadManager, UploadProgress } from '../lib/ParallelUploadManager';

interface UploadedPhoto {
  uploadId: string;
  filename: string;
  cdnUrl?: string;
  status: 'uploading' | 'completed' | 'failed';
}

interface BatchUploadProps {
  onPhotosUploaded?: (photos: UploadedPhoto[]) => void;
}

/**
 * Batch Upload Component - Optimized for 100 concurrent uploads
 *
 * This component demonstrates how to upload 100 photos in < 10 seconds:
 * 1. User selects 100 files
 * 2. All 100 uploads start immediately in parallel
 * 3. Real-time progress tracking for each upload
 * 4. Performance metrics displayed
 *
 * Performance optimizations:
 * - No artificial queuing - all uploads start at once
 * - Browser handles HTTP/2 connection multiplexing
 * - Direct S3 upload (no server bandwidth)
 * - Multipart uploads for large files
 */

export const BatchUpload: React.FC<BatchUploadProps> = ({ onPhotosUploaded }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<{
    totalFiles: number;
    completedFiles: number;
    failedFiles: number;
    totalTimeSeconds: number;
    averageSpeed: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadManagerRef = useRef<ParallelUploadManager>(
    new ParallelUploadManager()
  );
  const startTimeRef = useRef<number>(0);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    setFiles(selectedFiles);
    setUploadProgress([]);
    setPerformanceMetrics(null);
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      alert('Please select files to upload');
      return;
    }

    setUploading(true);
    startTimeRef.current = performance.now();

    try {
      const results = await uploadManagerRef.current.uploadBatch(
        files,
        (allProgress) => {
          // Update progress in real-time
          setUploadProgress([...allProgress]);
        }
      );

      const endTime = performance.now();
      const totalTimeSeconds = (endTime - startTimeRef.current) / 1000;
      const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
      const totalMB = totalBytes / (1024 * 1024);
      const averageSpeed = (totalMB / totalTimeSeconds).toFixed(2);

      const completedFiles = results.filter((r) => r.status === 'completed').length;
      const failedFiles = results.filter((r) => r.status === 'failed').length;

      setPerformanceMetrics({
        totalFiles: files.length,
        completedFiles,
        failedFiles,
        totalTimeSeconds: parseFloat(totalTimeSeconds.toFixed(2)),
        averageSpeed: `${averageSpeed} MB/s`,
      });

      console.log('Upload Performance Metrics:');
      console.log(`Total files: ${files.length}`);
      console.log(`Completed: ${completedFiles}`);
      console.log(`Failed: ${failedFiles}`);
      console.log(`Total time: ${totalTimeSeconds.toFixed(2)}s`);
      console.log(`Average speed: ${averageSpeed} MB/s`);
      console.log(
        `Target achieved: ${totalTimeSeconds < 10 ? '✅ YES' : '❌ NO'} (< 10s)`
      );

      // Notify parent component of uploaded photos
      if (onPhotosUploaded) {
        const uploadedPhotos: UploadedPhoto[] = results
          .filter((r) => r.status === 'completed' || r.status === 'failed' || r.status === 'uploading')
          .map((r) => ({
            uploadId: r.uploadId,
            filename: r.filename,
            cdnUrl: undefined, // Will be populated by backend response
            status: r.status as 'uploading' | 'completed' | 'failed',
          }));
        onPhotosUploaded(uploadedPhotos);
      }
    } catch (error) {
      console.error('Batch upload failed:', error);
      alert('Some uploads failed. Check console for details.');
    } finally {
      setUploading(false);
    }
  };

  const handleClear = () => {
    setFiles([]);
    setUploadProgress([]);
    setPerformanceMetrics(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const completedCount = uploadProgress.filter(
    (p) => p.status === 'completed'
  ).length;
  const failedCount = uploadProgress.filter((p) => p.status === 'failed').length;
  const uploadingCount = uploadProgress.filter(
    (p) => p.status === 'uploading'
  ).length;

  return (
    <div className="batch-upload-container">
      <h1>High-Performance Batch Photo Upload</h1>
      <p>Target: Upload 100 photos (2MB each) in less than 10 seconds</p>

      <div className="upload-controls">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          onChange={handleFileSelect}
          disabled={uploading}
        />

        <div className="button-group">
          <button onClick={handleUpload} disabled={uploading || files.length === 0}>
            {uploading ? 'Uploading...' : `Upload ${files.length} Files`}
          </button>
          <button onClick={handleClear} disabled={uploading}>
            Clear
          </button>
        </div>
      </div>

      {files.length > 0 && (
        <div className="file-summary">
          <h3>Selected Files: {files.length}</h3>
          <p>
            Total size:{' '}
            {(
              files.reduce((sum, file) => sum + file.size, 0) /
              (1024 * 1024)
            ).toFixed(2)}{' '}
            MB
          </p>
        </div>
      )}

      {uploading && (
        <div className="upload-status">
          <h3>Upload Status</h3>
          <div className="status-summary">
            <span className="status-item">
              ⏳ Uploading: {uploadingCount}
            </span>
            <span className="status-item">
              ✅ Completed: {completedCount}
            </span>
            <span className="status-item">❌ Failed: {failedCount}</span>
          </div>
          <div className="overall-progress">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width: `${(completedCount / files.length) * 100}%`,
                }}
              />
            </div>
            <span>
              {completedCount} / {files.length} (
              {((completedCount / files.length) * 100).toFixed(1)}%)
            </span>
          </div>
        </div>
      )}

      {performanceMetrics && (
        <div className="performance-metrics">
          <h3>Performance Metrics</h3>
          <div className="metrics-grid">
            <div className="metric">
              <span className="metric-label">Total Files:</span>
              <span className="metric-value">{performanceMetrics.totalFiles}</span>
            </div>
            <div className="metric">
              <span className="metric-label">Completed:</span>
              <span className="metric-value metric-success">
                {performanceMetrics.completedFiles}
              </span>
            </div>
            <div className="metric">
              <span className="metric-label">Failed:</span>
              <span className="metric-value metric-error">
                {performanceMetrics.failedFiles}
              </span>
            </div>
            <div className="metric">
              <span className="metric-label">Total Time:</span>
              <span className="metric-value">
                {performanceMetrics.totalTimeSeconds}s
              </span>
            </div>
            <div className="metric">
              <span className="metric-label">Average Speed:</span>
              <span className="metric-value">
                {performanceMetrics.averageSpeed}
              </span>
            </div>
            <div className="metric">
              <span className="metric-label">Target Achieved:</span>
              <span
                className={`metric-value ${
                  performanceMetrics.totalTimeSeconds < 10
                    ? 'metric-success'
                    : 'metric-error'
                }`}
              >
                {performanceMetrics.totalTimeSeconds < 10 ? '✅ YES' : '❌ NO'}{' '}
                ({'< 10s'})
              </span>
            </div>
          </div>
        </div>
      )}

      {uploadProgress.length > 0 && (
        <div className="upload-list">
          <h3>Individual Upload Progress</h3>
          <div className="upload-items">
            {uploadProgress.slice(0, 20).map((progress, index) => (
              <div key={index} className="upload-item">
                <div className="upload-item-header">
                  <span className="filename">{progress.filename}</span>
                  <span className="status-badge status-{progress.status}">
                    {progress.status}
                  </span>
                </div>
                <div className="upload-item-progress">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${progress.progress}%` }}
                    />
                  </div>
                  <span>{progress.progress.toFixed(0)}%</span>
                </div>
                {progress.error && (
                  <div className="error-message">{progress.error}</div>
                )}
              </div>
            ))}
            {uploadProgress.length > 20 && (
              <div className="more-items">
                ... and {uploadProgress.length - 20} more files
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
