package com.levantafia.controller;

import com.levantafia.dto.*;
import com.levantafia.entity.PhotoUpload;
import com.levantafia.service.S3MultipartUploadService;
import com.levantafia.service.UploadService;
import io.micrometer.core.annotation.Timed;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Async;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

/**
 * Upload Controller - Optimized for High-Performance Concurrent Uploads
 *
 * This controller handles the upload workflow with Virtual Threads:
 * 1. POST /init - Initialize upload, get presigned URLs (runs on Virtual Thread)
 * 2. Client uploads directly to S3 using presigned URLs (100 uploads × 10 parts in parallel)
 * 3. POST /complete - Finalize upload after S3 upload completes (runs on Virtual Thread)
 *
 * Performance Target: 100 photos (2MB each) in < 10 seconds
 *
 * How we achieve it:
 * - Virtual Threads: All 100 uploads processed concurrently without thread pool limits
 * - Direct S3 upload: No server bandwidth consumed, S3's network handles it
 * - Multipart upload: Each 2MB file split into chunks uploaded in parallel
 * - CRT HTTP client: 1000 concurrent S3 operations supported
 *
 * Expected flow for 100 concurrent uploads:
 * - T+0ms: Client sends 100 POST /init requests
 * - T+50ms: All 100 Virtual Threads spawn, generate presigned URLs, return to client
 * - T+100ms: Client starts uploading all 100 files to S3 (each with 10 parallel parts)
 * - T+8000ms: All uploads to S3 complete (network-bound, not server-bound)
 * - T+8050ms: Client sends 100 POST /complete requests
 * - T+8100ms: All uploads finalized
 * - Total: ~8.1 seconds (well under 10 second target)
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/uploads")
@RequiredArgsConstructor
public class UploadController {

    private final UploadService uploadService;
    private final S3MultipartUploadService s3MultipartUploadService;

    @org.springframework.beans.factory.annotation.Value("${cloudfront.domain}")
    private String cloudfrontDomain;

    /**
     * Initialize upload - Returns presigned URLs for direct S3 upload
     * This endpoint is fully async and uses Virtual Threads
     *
     * @param request Upload initialization request
     * @return Presigned URLs for uploading to S3
     */
    @PostMapping("/init")
    @Timed(value = "upload.init", description = "Time to initialize upload")
    public CompletableFuture<ResponseEntity<UploadInitResponse>> initiateUpload(
            @Valid @RequestBody UploadInitRequest request) {

        log.info("Initiating upload: filename={}, size={} bytes",
                request.getFilename(), request.getFileSizeBytes());

        // Generate S3 key
        UUID uploadId = UUID.randomUUID();
        String s3Key = s3MultipartUploadService.generateS3Key(uploadId, request.getFilename());

        // Create the upload job record synchronously BEFORE any async operations
        // This MUST happen in the main request thread to ensure proper transaction commit
        // The @Async annotation was causing transaction visibility issues
        PhotoUpload uploadJob = uploadService.createUploadJob(
                uploadId,
                request.getFilename(),
                request.getFileSizeBytes(),
                request.getContentType(),
                s3Key,
                null);  // multipartUploadId will be updated later

        // Now initiate multipart upload and get presigned URLs (this is async)
        return s3MultipartUploadService.initiateMultipartUpload(
                        s3Key,
                        request.getContentType(),
                        request.getFileSizeBytes())
                .thenApply(multipartResponse -> {
                    // Build response
                    UploadInitResponse response = UploadInitResponse.builder()
                            .uploadId(uploadId)
                            .s3Key(s3Key)
                            .multipartUploadId(multipartResponse.getUploadId())
                            .multipart(multipartResponse.isMultipart())
                            .partSize(multipartResponse.getPartSize())
                            .numberOfParts(multipartResponse.getNumberOfParts())
                            .presignedUrls(multipartResponse.getPresignedUrls())
                            .expiresInMinutes(15)
                            .build();

                    log.info("Upload initialized: uploadId={}, multipart={}, parts={}",
                            uploadId, multipartResponse.isMultipart(),
                            multipartResponse.getNumberOfParts());

                    return ResponseEntity.accepted().body(response);
                })
                .exceptionally(throwable -> {
                    log.error("Failed to initiate upload", throwable);
                    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
                });
    }

    /**
     * Complete upload - Finalize after S3 upload completes
     * Returns CompletableFuture for async processing, but controller method runs on request thread
     *
     * CRITICAL FIX: This endpoint NO LONGER queries the database for upload metadata.
     * Instead, it receives ALL metadata from the client (filename, size, contentType, s3Key, etc.)
     * This eliminates PostgreSQL snapshot isolation issues that caused "Upload not found" errors.
     *
     * @param request Upload completion request with ETags and ALL metadata from /init
     * @return Upload completion status
     */
    @PostMapping("/complete")
    @Timed(value = "upload.complete", description = "Time to complete upload")
    public CompletableFuture<ResponseEntity<UploadCompleteResponse>> completeUpload(
            @Valid @RequestBody UploadCompleteRequest request) {

        log.info("Completing upload: uploadId={}, s3Key={}, filename={}",
                request.getUploadId(), request.getS3Key(), request.getFilename());

        // NO DATABASE QUERY! Use ALL metadata passed from client (which came from /init response)
        // This completely eliminates the PostgreSQL snapshot isolation problem

        // Proceed with async S3 operations using the passed-in metadata
        CompletableFuture<PhotoUpload> completionFuture;
        if (request.getMultipartUploadId() != null) {
            // If multipart, complete the multipart upload on S3
            completionFuture = s3MultipartUploadService.completeMultipartUpload(
                            request.getS3Key(),
                            request.getMultipartUploadId(),
                            request.getPartETags())
                    .thenCompose(s3Response ->
                            uploadService.finalizeUpload(
                                    request.getUploadId(),
                                    request.getS3Key(),
                                    request.getFilename(),
                                    request.getFileSizeBytes(),
                                    request.getContentType(),
                                    "anonymous",  // Default userId
                                    "default",    // Default organizationId
                                    s3Response.eTag()
                            ));
        } else {
            // Single-part upload, just finalize
            completionFuture = uploadService.finalizeUpload(
                    request.getUploadId(),
                    request.getS3Key(),
                    request.getFilename(),
                    request.getFileSizeBytes(),
                    request.getContentType(),
                    "anonymous",  // Default userId
                    "default",    // Default organizationId
                    request.getPartETags().get(0)
            );
        }

        return completionFuture
                .thenApply(finalizedUpload -> {
                    String cdnUrl = String.format("https://%s/%s", cloudfrontDomain, finalizedUpload.getS3Key());

                    UploadCompleteResponse response = UploadCompleteResponse.builder()
                            .uploadId(finalizedUpload.getId())
                            .s3Key(finalizedUpload.getS3Key())
                            .status(finalizedUpload.getStatus().toString())
                            .photoId(finalizedUpload.getPhotoId())
                            .cdnUrl(cdnUrl)
                            .filename(finalizedUpload.getFilename())
                            .build();

                    log.info("Upload completed successfully: uploadId={}, photoId={}",
                            finalizedUpload.getId(), finalizedUpload.getPhotoId());

                    return ResponseEntity.ok(response);
                })
                .exceptionally(throwable -> {
                    log.error("Failed to complete upload: uploadId={}", request.getUploadId(), throwable);
                    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
                });
    }

    /**
     * Abort upload - Cancel an in-progress upload
     */
    @DeleteMapping("/{uploadId}")
    @Async("virtualThreadExecutor")
    public CompletableFuture<ResponseEntity<Void>> abortUpload(@PathVariable UUID uploadId) {
        log.warn("Aborting upload: uploadId={}", uploadId);

        return CompletableFuture.supplyAsync(() -> uploadService.getUploadJob(uploadId))
                .thenCompose(uploadJob -> {
                    if (uploadJob.getMultipartUploadId() != null) {
                        return s3MultipartUploadService.abortMultipartUpload(
                                uploadJob.getS3Key(),
                                uploadJob.getMultipartUploadId());
                    }
                    return CompletableFuture.completedFuture(null);
                })
                .thenCompose(v -> uploadService.abortUpload(uploadId))
                .thenApply(v -> ResponseEntity.noContent().<Void>build())
                .exceptionally(throwable -> {
                    log.error("Failed to abort upload", throwable);
                    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
                });
    }

    /**
     * Get upload status
     */
    @GetMapping("/{uploadId}")
    @Async("virtualThreadExecutor")
    public CompletableFuture<ResponseEntity<UploadStatusResponse>> getUploadStatus(
            @PathVariable UUID uploadId) {

        return CompletableFuture.supplyAsync(() -> uploadService.getUploadJob(uploadId))
                .thenApply(uploadJob -> {
                    UploadStatusResponse response = UploadStatusResponse.builder()
                            .uploadId(uploadJob.getId())
                            .filename(uploadJob.getFilename())
                            .status(uploadJob.getStatus().toString())
                            .progress(uploadJob.getProgress())
                            .createdAt(uploadJob.getCreatedAt())
                            .completedAt(uploadJob.getCompletedAt())
                            .build();

                    return ResponseEntity.ok(response);
                })
                .exceptionally(throwable -> {
                    log.error("Failed to get upload status", throwable);
                    return ResponseEntity.notFound().build();
                });
    }

    /**
     * Batch upload status - Get status for multiple uploads
     * Useful for tracking progress of 100 concurrent uploads
     */
    @PostMapping("/status/batch")
    @Async("virtualThreadExecutor")
    public CompletableFuture<ResponseEntity<List<UploadStatusResponse>>> getBatchUploadStatus(
            @RequestBody List<UUID> uploadIds) {

        log.info("Getting batch upload status for {} uploads", uploadIds.size());

        // Process all status requests concurrently using Virtual Threads
        List<CompletableFuture<UploadStatusResponse>> statusFutures = uploadIds.stream()
                .map(uploadId -> CompletableFuture.supplyAsync(() -> uploadService.getUploadJob(uploadId))
                        .thenApply(uploadJob -> UploadStatusResponse.builder()
                                .uploadId(uploadJob.getId())
                                .filename(uploadJob.getFilename())
                                .status(uploadJob.getStatus().toString())
                                .progress(uploadJob.getProgress())
                                .createdAt(uploadJob.getCreatedAt())
                                .completedAt(uploadJob.getCompletedAt())
                                .build())
                        .exceptionally(throwable -> {
                            log.warn("Failed to get status for uploadId={}", uploadId);
                            return null;
                        }))
                .toList();

        return CompletableFuture.allOf(statusFutures.toArray(new CompletableFuture[0]))
                .thenApply(v -> {
                    List<UploadStatusResponse> statuses = statusFutures.stream()
                            .map(CompletableFuture::join)
                            .filter(status -> status != null)
                            .toList();

                    return ResponseEntity.ok(statuses);
                });
    }
}
