package com.levantafia.performance;

import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Performance Benchmark Test for Upload System
 *
 * This test validates that the system can handle 100 concurrent uploads
 * in less than 10 seconds, as per the performance requirements.
 *
 * Test Scenario:
 * 1. Generate 100 mock files (2MB each)
 * 2. Initialize all 100 uploads concurrently
 * 3. Simulate S3 uploads (or use actual S3 in integration test)
 * 4. Complete all 100 uploads
 * 5. Measure total time and validate < 10 seconds
 *
 * Success Criteria:
 * - All 100 uploads complete successfully
 * - Total time < 10 seconds
 * - No errors or timeouts
 * - Virtual threads handle all concurrent requests
 */
@Slf4j
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
public class UploadPerformanceBenchmark {

    @LocalServerPort
    private int port;

    private static final int TOTAL_UPLOADS = 100;
    private static final long FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
    private static final int TARGET_TIME_SECONDS = 10;

    @Test
    public void testConcurrent100UploadsUnder10Seconds() throws Exception {
        log.info("Starting performance benchmark: {} concurrent uploads", TOTAL_UPLOADS);

        // Metrics tracking
        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger failureCount = new AtomicInteger(0);
        Map<String, Duration> uploadDurations = new ConcurrentHashMap<>();

        Instant startTime = Instant.now();

        // Create test REST client
        TestRestTemplate restTemplate = new TestRestTemplate();
        String baseUrl = "http://localhost:" + port + "/api/v1/uploads";

        // Generate 100 upload tasks
        List<CompletableFuture<Void>> uploadFutures = new ArrayList<>();

        for (int i = 0; i < TOTAL_UPLOADS; i++) {
            final int uploadIndex = i;
            final String filename = String.format("test-image-%03d.jpg", i);

            // Execute each upload asynchronously
            CompletableFuture<Void> uploadFuture = CompletableFuture.runAsync(() -> {
                Instant uploadStartTime = Instant.now();

                try {
                    // Step 1: Initialize upload
                    HttpHeaders headers = new HttpHeaders();
                    headers.setContentType(MediaType.APPLICATION_JSON);

                    Map<String, Object> initRequest = Map.of(
                            "filename", filename,
                            "fileSizeBytes", FILE_SIZE_BYTES,
                            "contentType", "image/jpeg"
                    );

                    HttpEntity<Map<String, Object>> requestEntity =
                            new HttpEntity<>(initRequest, headers);

                    ResponseEntity<Map> initResponse = restTemplate.postForEntity(
                            baseUrl + "/init",
                            requestEntity,
                            Map.class
                    );

                    assertThat(initResponse.getStatusCode().is2xxSuccessful())
                            .as("Upload init should succeed for upload " + uploadIndex)
                            .isTrue();

                    String uploadId = (String) initResponse.getBody().get("uploadId");
                    List<String> presignedUrls = (List<String>) initResponse.getBody().get("presignedUrls");

                    log.debug("Upload {} initialized: uploadId={}, presignedUrls={}",
                            uploadIndex, uploadId, presignedUrls.size());

                    // Step 2: Simulate S3 upload
                    // In a real test, we would upload to S3 here
                    // For benchmark, we'll simulate the time it takes
                    simulateS3Upload(presignedUrls.size());

                    // Step 3: Complete upload
                    Map<String, Object> completeRequest = Map.of(
                            "uploadId", uploadId,
                            "partETags", List.of("mock-etag-" + uploadIndex)
                    );

                    HttpEntity<Map<String, Object>> completeEntity =
                            new HttpEntity<>(completeRequest, headers);

                    ResponseEntity<Map> completeResponse = restTemplate.postForEntity(
                            baseUrl + "/complete",
                            completeEntity,
                            Map.class
                    );

                    assertThat(completeResponse.getStatusCode().is2xxSuccessful())
                            .as("Upload complete should succeed for upload " + uploadIndex)
                            .isTrue();

                    Instant uploadEndTime = Instant.now();
                    Duration uploadDuration = Duration.between(uploadStartTime, uploadEndTime);
                    uploadDurations.put(uploadId, uploadDuration);

                    successCount.incrementAndGet();

                    log.debug("Upload {} completed in {}ms",
                            uploadIndex, uploadDuration.toMillis());

                } catch (Exception e) {
                    failureCount.incrementAndGet();
                    log.error("Upload {} failed", uploadIndex, e);
                }
            });

            uploadFutures.add(uploadFuture);
        }

        // Wait for all uploads to complete
        CompletableFuture<Void> allUploads = CompletableFuture.allOf(
                uploadFutures.toArray(new CompletableFuture[0])
        );

        allUploads.join();

        Instant endTime = Instant.now();
        Duration totalDuration = Duration.between(startTime, endTime);

        // Calculate statistics
        double totalTimeSeconds = totalDuration.toMillis() / 1000.0;
        double averageUploadTime = uploadDurations.values().stream()
                .mapToLong(Duration::toMillis)
                .average()
                .orElse(0) / 1000.0;

        long minUploadTime = uploadDurations.values().stream()
                .mapToLong(Duration::toMillis)
                .min()
                .orElse(0);

        long maxUploadTime = uploadDurations.values().stream()
                .mapToLong(Duration::toMillis)
                .max()
                .orElse(0);

        // Log results
        log.info("========================================");
        log.info("PERFORMANCE BENCHMARK RESULTS");
        log.info("========================================");
        log.info("Total uploads: {}", TOTAL_UPLOADS);
        log.info("Successful uploads: {}", successCount.get());
        log.info("Failed uploads: {}", failureCount.get());
        log.info("Total time: {:.2f} seconds", totalTimeSeconds);
        log.info("Average upload time: {:.2f} seconds", averageUploadTime);
        log.info("Min upload time: {} ms", minUploadTime);
        log.info("Max upload time: {} ms", maxUploadTime);
        log.info("Throughput: {:.2f} uploads/second",
                TOTAL_UPLOADS / totalTimeSeconds);
        log.info("========================================");

        // Performance assertions
        assertThat(successCount.get())
                .as("All uploads should succeed")
                .isEqualTo(TOTAL_UPLOADS);

        assertThat(failureCount.get())
                .as("No uploads should fail")
                .isEqualTo(0);

        assertThat(totalTimeSeconds)
                .as("Total time should be under " + TARGET_TIME_SECONDS + " seconds")
                .isLessThan(TARGET_TIME_SECONDS);

        // Log success message
        if (totalTimeSeconds < TARGET_TIME_SECONDS) {
            log.info("✅ PERFORMANCE TARGET ACHIEVED: {} uploads in {:.2f}s (< {}s)",
                    TOTAL_UPLOADS, totalTimeSeconds, TARGET_TIME_SECONDS);
        } else {
            log.warn("❌ PERFORMANCE TARGET MISSED: {} uploads in {:.2f}s (target: < {}s)",
                    TOTAL_UPLOADS, totalTimeSeconds, TARGET_TIME_SECONDS);
        }
    }

    /**
     * Simulates S3 upload time
     * In a real test, this would be actual S3 upload
     */
    private void simulateS3Upload(int numberOfParts) {
        try {
            // Simulate network latency for S3 upload
            // For 2MB file with 10MB/s network: ~200ms
            // For multipart (4 parts): ~50ms per part in parallel
            if (numberOfParts > 1) {
                Thread.sleep(50); // Multipart is faster due to parallelism
            } else {
                Thread.sleep(200); // Single part upload
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    /**
     * Stress test: 1000 concurrent uploads
     * This tests the absolute limits of the system
     */
    @Test
    public void stressTest1000ConcurrentUploads() throws Exception {
        log.info("Starting STRESS TEST: 1000 concurrent uploads");

        final int STRESS_TEST_UPLOADS = 1000;
        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger failureCount = new AtomicInteger(0);

        Instant startTime = Instant.now();

        TestRestTemplate restTemplate = new TestRestTemplate();
        String baseUrl = "http://localhost:" + port + "/api/v1/uploads";

        List<CompletableFuture<Void>> uploadFutures = new ArrayList<>();

        for (int i = 0; i < STRESS_TEST_UPLOADS; i++) {
            final String filename = String.format("stress-test-%04d.jpg", i);

            CompletableFuture<Void> uploadFuture = CompletableFuture.runAsync(() -> {
                try {
                    HttpHeaders headers = new HttpHeaders();
                    headers.setContentType(MediaType.APPLICATION_JSON);

                    Map<String, Object> initRequest = Map.of(
                            "filename", filename,
                            "fileSizeBytes", FILE_SIZE_BYTES,
                            "contentType", "image/jpeg"
                    );

                    HttpEntity<Map<String, Object>> requestEntity =
                            new HttpEntity<>(initRequest, headers);

                    ResponseEntity<Map> response = restTemplate.postForEntity(
                            baseUrl + "/init",
                            requestEntity,
                            Map.class
                    );

                    if (response.getStatusCode().is2xxSuccessful()) {
                        successCount.incrementAndGet();
                    } else {
                        failureCount.incrementAndGet();
                    }
                } catch (Exception e) {
                    failureCount.incrementAndGet();
                }
            });

            uploadFutures.add(uploadFuture);
        }

        CompletableFuture.allOf(uploadFutures.toArray(new CompletableFuture[0])).join();

        Instant endTime = Instant.now();
        Duration totalDuration = Duration.between(startTime, endTime);
        double totalTimeSeconds = totalDuration.toMillis() / 1000.0;

        log.info("========================================");
        log.info("STRESS TEST RESULTS");
        log.info("========================================");
        log.info("Total uploads attempted: {}", STRESS_TEST_UPLOADS);
        log.info("Successful: {}", successCount.get());
        log.info("Failed: {}", failureCount.get());
        log.info("Success rate: {:.2f}%",
                (successCount.get() * 100.0) / STRESS_TEST_UPLOADS);
        log.info("Total time: {:.2f} seconds", totalTimeSeconds);
        log.info("Throughput: {:.2f} uploads/second",
                STRESS_TEST_UPLOADS / totalTimeSeconds);
        log.info("========================================");

        // In stress test, we accept some failures but expect high success rate
        assertThat(successCount.get() / (double) STRESS_TEST_UPLOADS)
                .as("Success rate should be > 95%")
                .isGreaterThan(0.95);
    }
}
