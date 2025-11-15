package com.levantafia.service;

import com.levantafia.entity.Photo;
import com.levantafia.entity.PhotoUpload;
import com.levantafia.repository.PhotoRepository;
import com.levantafia.repository.PhotoUploadRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

/**
 * Upload Service - Manages photo upload lifecycle
 *
 * This service handles:
 * 1. Creating upload jobs when initiation starts
 * 2. Finalizing uploads after S3 upload completes
 * 3. Creating Photo records in database
 * 4. Tracking upload status and progress
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UploadService {

    private final PhotoUploadRepository photoUploadRepository;
    private final PhotoRepository photoRepository;
    private final TransactionTemplate transactionTemplate;

    @Value("${cloudfront.domain}")
    private String cloudfrontDomain;

    /**
     * Creates a new upload job record when upload is initiated
     * NOTE: Uses TransactionTemplate to execute in a NEW transaction that commits immediately.
     * This ensures the record is visible to other transactions/threads immediately,
     * preventing race conditions where /complete arrives before the record exists.
     */
    public PhotoUpload createUploadJob(
            UUID uploadId,
            String filename,
            Long fileSizeBytes,
            String contentType,
            String s3Key,
            String multipartUploadId) {

        log.info("Creating upload job: uploadId={}, filename={}", uploadId, filename);

        // Use TransactionTemplate to execute in a new transaction
        // This commits immediately when the execute() method completes
        return transactionTemplate.execute(status -> {
            PhotoUpload photoUpload = PhotoUpload.builder()
                    .id(uploadId)
                    .userId("anonymous")  // Explicitly set default value
                    .organizationId("default")  // Explicitly set default value
                    .filename(filename)
                    .fileSizeBytes(fileSizeBytes)
                    .contentType(contentType)
                    .s3Key(s3Key)
                    .multipartUploadId(multipartUploadId)
                    .status(PhotoUpload.PhotoUploadStatus.INITIATED)
                    .progress(0)
                    .build();

            photoUpload = photoUploadRepository.save(photoUpload);
            photoUploadRepository.flush();  // Force immediate database flush
            log.info("Upload job created: uploadId={}", uploadId);

            return photoUpload;
        });
    }

    /**
     * Updates the multipart upload ID for an existing upload job
     * This is called after S3 multipart upload is initiated
     *
     * NOTE: Uses READ_COMMITTED isolation to ensure we can read the just-created record
     */
    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public void updateMultipartUploadId(UUID uploadId, String multipartUploadId) {
        PhotoUpload photoUpload = photoUploadRepository.findById(uploadId)
                .orElseThrow(() -> new RuntimeException("Upload not found: " + uploadId));

        photoUpload.setMultipartUploadId(multipartUploadId);
        photoUploadRepository.save(photoUpload);

        log.debug("Updated multipart upload ID for uploadId={}", uploadId);
    }

    /**
     * Gets an upload job by ID
     * NOTE: Uses native SQL query to bypass EntityManager cache completely
     * This ensures we always query PostgreSQL directly with fresh data
     */
    public PhotoUpload getUploadJob(UUID uploadId) {
        log.debug("Querying upload job with native SQL: uploadId={}", uploadId);
        return photoUploadRepository.findByIdNative(uploadId)
                .orElseThrow(() -> new RuntimeException("Upload not found: " + uploadId));
    }

    /**
     * Finalizes an upload after S3 upload completes
     * Creates the Photo record in database
     *
     * CRITICAL: This method NO LONGER queries the database to fetch PhotoUpload.
     * All metadata is passed as parameters to avoid PostgreSQL snapshot isolation issues.
     *
     * TRANSACTION FIX: Removed CompletableFuture.supplyAsync() to maintain transaction context.
     * The @Async annotation provides async behavior while @Transactional ensures proper transaction.
     *
     * @param uploadId Upload ID
     * @param s3Key S3 key where file is stored
     * @param filename Original filename
     * @param fileSizeBytes File size in bytes
     * @param contentType MIME type
     * @param userId User ID (default: "anonymous")
     * @param organizationId Organization ID (default: "default")
     * @param eTag S3 ETag from upload
     * @return CompletableFuture with the finalized PhotoUpload
     */
    @Async("virtualThreadExecutor")
    @Transactional
    public CompletableFuture<PhotoUpload> finalizeUpload(
            UUID uploadId,
            String s3Key,
            String filename,
            Long fileSizeBytes,
            String contentType,
            String userId,
            String organizationId,
            String eTag) {

        log.info("Finalizing upload: uploadId={}, s3Key={}, eTag={}", uploadId, s3Key, eTag);

        // NO DATABASE QUERY! Create Photo record directly using passed-in metadata
        Photo photo = Photo.builder()
                .userId(userId)
                .organizationId(organizationId)
                .s3Key(s3Key)
                .filename(filename)
                .sizeBytes(fileSizeBytes)
                .mimeType(contentType)
                .build();

        photo = photoRepository.save(photo);
        log.info("Photo created: photoId={}", photo.getId());

        // Update PhotoUpload status using UPDATE query (no SELECT first)
        // This runs in the same transaction as Photo creation
        int rowsUpdated = photoUploadRepository.updatePhotoUploadStatus(
                uploadId,
                PhotoUpload.PhotoUploadStatus.COMPLETED,
                100,
                photo.getId(),
                Instant.now()
        );

        if (rowsUpdated == 0) {
            log.warn("PhotoUpload not found for update: uploadId={}", uploadId);
            // Don't throw exception - photo was created successfully
        }

        log.info("Upload finalized successfully: uploadId={}, photoId={}", uploadId, photo.getId());

        // Return a PhotoUpload object with the data we know
        PhotoUpload photoUpload = PhotoUpload.builder()
                .id(uploadId)
                .userId(userId)
                .organizationId(organizationId)
                .s3Key(s3Key)
                .filename(filename)
                .fileSizeBytes(fileSizeBytes)
                .contentType(contentType)
                .photoId(photo.getId())
                .status(PhotoUpload.PhotoUploadStatus.COMPLETED)
                .progress(100)
                .completedAt(Instant.now())
                .build();

        return CompletableFuture.completedFuture(photoUpload);
    }

    /**
     * Aborts an upload
     */
    @Async("virtualThreadExecutor")
    @Transactional
    public CompletableFuture<Void> abortUpload(UUID uploadId) {
        return CompletableFuture.supplyAsync(() -> {
            log.warn("Aborting upload: uploadId={}", uploadId);

            PhotoUpload photoUpload = photoUploadRepository.findById(uploadId)
                    .orElseThrow(() -> new RuntimeException("Upload not found: " + uploadId));

            photoUpload.setStatus(PhotoUpload.PhotoUploadStatus.ABORTED);
            photoUpload.setErrorMessage("Upload aborted by user");
            photoUpload.setCompletedAt(Instant.now());
            photoUploadRepository.save(photoUpload);

            log.info("Upload aborted: uploadId={}", uploadId);
            return null;
        });
    }
}
