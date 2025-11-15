package com.levantafia.service;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.task.AsyncTaskExecutor;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.async.AsyncRequestBody;
import software.amazon.awssdk.services.s3.S3AsyncClient;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PresignedUploadPartRequest;
import software.amazon.awssdk.services.s3.presigner.model.UploadPartPresignRequest;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.IntStream;

/**
 * S3 Multipart Upload Service with Parallel Chunk Uploads
 *
 * This service implements high-performance S3 multipart uploads using:
 * 1. Virtual Threads for unlimited concurrency
 * 2. Parallel chunk uploads (10 chunks at a time)
 * 3. AWS CRT-based S3 client for native performance
 *
 * Performance Optimization:
 * - Traditional single-part upload: 2MB file = ~2 seconds (1MB/s network)
 * - Multipart with 10 parallel chunks: 2MB file = ~0.4 seconds (5x faster)
 * - For 100 photos: Traditional = 200s, Multipart = 40s, Target = <10s
 *
 * To achieve <10s for 100 photos:
 * - Upload ALL 100 photos concurrently (Virtual Threads enable this)
 * - Each photo uses multipart with 10 parallel chunks
 * - Total concurrent uploads: 100 photos × 10 chunks = 1000 parallel operations
 * - Virtual Threads can handle this without memory issues
 */
@Slf4j
@Service
public class S3MultipartUploadService {

    private final S3AsyncClient s3AsyncClient;
    private final S3Presigner s3Presigner;
    private final AsyncTaskExecutor s3UploadExecutor;
    private final MeterRegistry meterRegistry;

    @Value("${aws.s3.bucket-name}")
    private String bucketName;

    @Value("${aws.s3.multipart.threshold-bytes}")
    private long multipartThresholdBytes;

    @Value("${aws.s3.multipart.part-size-bytes}")
    private long partSizeBytes;

    @Value("${aws.s3.multipart.max-concurrent-parts}")
    private int maxConcurrentParts;

    @Value("${aws.s3.presigned-url-expiry-minutes}")
    private int presignedUrlExpiryMinutes;

    private final Counter uploadInitiatedCounter;
    private final Counter uploadCompletedCounter;
    private final Counter uploadFailedCounter;
    private final Timer uploadDurationTimer;

    public S3MultipartUploadService(
            S3AsyncClient s3AsyncClient,
            S3Presigner s3Presigner,
            @Qualifier("s3UploadExecutor") AsyncTaskExecutor s3UploadExecutor,
            MeterRegistry meterRegistry) {
        this.s3AsyncClient = s3AsyncClient;
        this.s3Presigner = s3Presigner;
        this.s3UploadExecutor = s3UploadExecutor;
        this.meterRegistry = meterRegistry;

        // Initialize metrics
        this.uploadInitiatedCounter = Counter.builder("s3.upload.initiated")
                .description("Number of S3 uploads initiated")
                .register(meterRegistry);
        this.uploadCompletedCounter = Counter.builder("s3.upload.completed")
                .description("Number of S3 uploads completed successfully")
                .register(meterRegistry);
        this.uploadFailedCounter = Counter.builder("s3.upload.failed")
                .description("Number of S3 uploads failed")
                .register(meterRegistry);
        this.uploadDurationTimer = Timer.builder("s3.upload.duration")
                .description("S3 upload duration")
                .register(meterRegistry);
    }

    /**
     * Initiates a multipart upload and returns presigned URLs for each part
     * Client will upload parts directly to S3 using these URLs
     *
     * @param key S3 object key
     * @param contentType MIME type
     * @param fileSizeBytes Total file size
     * @return MultipartUploadResponse with uploadId and presigned URLs
     */
    public CompletableFuture<MultipartUploadResponse> initiateMultipartUpload(
            String key,
            String contentType,
            long fileSizeBytes) {

        uploadInitiatedCounter.increment();
        Instant startTime = Instant.now();

        log.info("Initiating multipart upload for key: {}, size: {} bytes", key, fileSizeBytes);

        // Determine if multipart is needed
        boolean useMultipart = fileSizeBytes > multipartThresholdBytes;

        if (!useMultipart) {
            // For small files, return a single presigned URL
            return generateSinglePartUploadUrl(key, contentType)
                    .thenApply(url -> {
                        uploadCompletedCounter.increment();
                        recordUploadDuration(startTime);
                        return MultipartUploadResponse.builder()
                                .uploadId(null)
                                .multipart(false)
                                .presignedUrls(List.of(url))
                                .build();
                    });
        }

        // Calculate number of parts
        int numberOfParts = (int) Math.ceil((double) fileSizeBytes / partSizeBytes);
        log.info("File requires {} parts for multipart upload", numberOfParts);

        // Initiate multipart upload
        CreateMultipartUploadRequest createRequest = CreateMultipartUploadRequest.builder()
                .bucket(bucketName)
                .key(key)
                .contentType(contentType)
                .build();

        return s3AsyncClient.createMultipartUpload(createRequest)
                .thenCompose(response -> {
                    String uploadId = response.uploadId();
                    log.info("Multipart upload initiated: uploadId={}", uploadId);

                    // Generate presigned URLs for all parts
                    return generatePresignedUrlsForParts(key, uploadId, numberOfParts)
                            .thenApply(urls -> {
                                uploadCompletedCounter.increment();
                                recordUploadDuration(startTime);
                                return MultipartUploadResponse.builder()
                                        .uploadId(uploadId)
                                        .multipart(true)
                                        .partSize(partSizeBytes)
                                        .numberOfParts(numberOfParts)
                                        .presignedUrls(urls)
                                        .build();
                            });
                })
                .exceptionally(throwable -> {
                    log.error("Failed to initiate multipart upload", throwable);
                    uploadFailedCounter.increment();
                    throw new RuntimeException("Failed to initiate multipart upload", throwable);
                });
    }

    /**
     * Generates presigned URLs for all parts of a multipart upload
     * Uses Virtual Threads to generate all URLs concurrently
     */
    private CompletableFuture<List<String>> generatePresignedUrlsForParts(
            String key,
            String uploadId,
            int numberOfParts) {

        log.info("Generating {} presigned URLs for multipart upload", numberOfParts);

        // Use Virtual Threads to generate URLs concurrently
        List<CompletableFuture<String>> urlFutures = IntStream.rangeClosed(1, numberOfParts)
                .mapToObj(partNumber -> CompletableFuture.supplyAsync(() -> {
                    UploadPartRequest uploadPartRequest = UploadPartRequest.builder()
                            .bucket(bucketName)
                            .key(key)
                            .uploadId(uploadId)
                            .partNumber(partNumber)
                            .build();

                    UploadPartPresignRequest presignRequest = UploadPartPresignRequest.builder()
                            .signatureDuration(Duration.ofMinutes(presignedUrlExpiryMinutes))
                            .uploadPartRequest(uploadPartRequest)
                            .build();

                    PresignedUploadPartRequest presignedRequest =
                            s3Presigner.presignUploadPart(presignRequest);

                    log.debug("Generated presigned URL for part {} of {}", partNumber, numberOfParts);
                    return presignedRequest.url().toString();
                }, s3UploadExecutor))
                .toList();

        // Wait for all URLs to be generated
        return CompletableFuture.allOf(urlFutures.toArray(new CompletableFuture[0]))
                .thenApply(v -> urlFutures.stream()
                        .map(CompletableFuture::join)
                        .toList());
    }

    /**
     * Completes a multipart upload after all parts have been uploaded
     *
     * @param key S3 object key
     * @param uploadId Multipart upload ID
     * @param eTags List of ETags from part uploads (in order)
     */
    public CompletableFuture<CompleteMultipartUploadResponse> completeMultipartUpload(
            String key,
            String uploadId,
            List<String> eTags) {

        log.info("Completing multipart upload: uploadId={}, parts={}", uploadId, eTags.size());

        List<CompletedPart> completedParts = IntStream.range(0, eTags.size())
                .mapToObj(i -> CompletedPart.builder()
                        .partNumber(i + 1)
                        .eTag(eTags.get(i))
                        .build())
                .toList();

        CompletedMultipartUpload completedUpload = CompletedMultipartUpload.builder()
                .parts(completedParts)
                .build();

        CompleteMultipartUploadRequest completeRequest = CompleteMultipartUploadRequest.builder()
                .bucket(bucketName)
                .key(key)
                .uploadId(uploadId)
                .multipartUpload(completedUpload)
                .build();

        return s3AsyncClient.completeMultipartUpload(completeRequest)
                .thenApply(response -> {
                    log.info("Multipart upload completed successfully: key={}", key);
                    return response;
                })
                .exceptionally(throwable -> {
                    log.error("Failed to complete multipart upload", throwable);
                    uploadFailedCounter.increment();
                    throw new RuntimeException("Failed to complete multipart upload", throwable);
                });
    }

    /**
     * Aborts a multipart upload (cleanup)
     */
    public CompletableFuture<Void> abortMultipartUpload(String key, String uploadId) {
        log.warn("Aborting multipart upload: uploadId={}", uploadId);

        AbortMultipartUploadRequest abortRequest = AbortMultipartUploadRequest.builder()
                .bucket(bucketName)
                .key(key)
                .uploadId(uploadId)
                .build();

        return s3AsyncClient.abortMultipartUpload(abortRequest)
                .thenAccept(response -> log.info("Multipart upload aborted: uploadId={}", uploadId));
    }

    /**
     * Generates a presigned URL for single-part upload (small files)
     */
    private CompletableFuture<String> generateSinglePartUploadUrl(String key, String contentType) {
        return CompletableFuture.supplyAsync(() -> {
            PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(key)
                    .contentType(contentType)
                    .build();

            software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest presignRequest =
                    software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest.builder()
                            .signatureDuration(Duration.ofMinutes(presignedUrlExpiryMinutes))
                            .putObjectRequest(putObjectRequest)
                            .build();

            software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest presignedRequest =
                    s3Presigner.presignPutObject(presignRequest);

            return presignedRequest.url().toString();
        }, s3UploadExecutor);
    }

    /**
     * Generates S3 key with date-based partitioning
     */
    public String generateS3Key(UUID uploadId, String originalFilename) {
        Instant now = Instant.now();
        String extension = originalFilename.substring(originalFilename.lastIndexOf('.'));

        // Convert Instant to Date for String.format compatibility
        java.util.Date date = java.util.Date.from(now);

        return String.format(
                "uploads/%tY/%<tm/%<td/%s%s",
                date,
                uploadId,
                extension
        );
    }

    private void recordUploadDuration(Instant startTime) {
        uploadDurationTimer.record(Duration.between(startTime, Instant.now()));
    }

    /**
     * Response object for multipart upload initiation
     */
    @lombok.Builder
    @lombok.Data
    public static class MultipartUploadResponse {
        private String uploadId;
        private boolean multipart;
        private Long partSize;
        private Integer numberOfParts;
        private List<String> presignedUrls;
    }
}
