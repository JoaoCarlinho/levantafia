package com.levantafia.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.core.client.config.ClientOverrideConfiguration;
import software.amazon.awssdk.core.retry.RetryPolicy;
import software.amazon.awssdk.http.async.SdkAsyncHttpClient;
import software.amazon.awssdk.http.crt.AwsCrtAsyncHttpClient;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3AsyncClient;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.transfer.s3.S3TransferManager;

import java.time.Duration;

/**
 * AWS S3 Configuration with CRT-based Async Client
 *
 * Uses AWS Common Runtime (CRT) HTTP client for maximum performance:
 * - Native C implementation for HTTP/2 multiplexing
 * - Automatic connection pooling and reuse
 * - Optimized for high-throughput, low-latency operations
 * - Perfect for multipart uploads with parallel chunks
 *
 * Performance characteristics:
 * - Standard HTTP client: ~50 concurrent connections
 * - CRT HTTP client: ~500+ concurrent connections
 * - Native memory management (off-heap)
 * - Ideal for our 100 concurrent uploads × 10 parts = 1000 parallel operations
 */
@Slf4j
@Configuration
public class AwsS3Config {

    @Value("${aws.region}")
    private String awsRegion;

    @Value("${aws.s3.transfer-acceleration-enabled:false}")
    private boolean transferAccelerationEnabled;

    /**
     * S3 Async Client with CRT-based HTTP client
     * Optimized for high-concurrency multipart uploads
     */
    @Bean
    public S3AsyncClient s3AsyncClient() {
        log.info("Initializing S3 Async Client with CRT HTTP client for high-performance uploads");

        // CRT-based HTTP client configuration
        SdkAsyncHttpClient crtHttpClient = AwsCrtAsyncHttpClient.builder()
                .maxConcurrency(1000)  // Support 1000 concurrent requests (100 uploads × 10 parts)
                .connectionTimeout(Duration.ofSeconds(30))
                .build();

        // S3-specific configuration
        S3Configuration s3Config = S3Configuration.builder()
                .accelerateModeEnabled(transferAccelerationEnabled)
                .checksumValidationEnabled(true)
                .chunkedEncodingEnabled(true)
                .build();

        // Client override configuration
        ClientOverrideConfiguration clientConfig = ClientOverrideConfiguration.builder()
                .retryPolicy(RetryPolicy.builder()
                        .numRetries(3)
                        .build())
                .apiCallTimeout(Duration.ofMinutes(5))
                .apiCallAttemptTimeout(Duration.ofMinutes(2))
                .build();

        S3AsyncClient client = S3AsyncClient.builder()
                .region(Region.of(awsRegion))
                .credentialsProvider(DefaultCredentialsProvider.create())
                .httpClient(crtHttpClient)
                .serviceConfiguration(s3Config)
                .overrideConfiguration(clientConfig)
                .build();

        log.info("S3 Async Client initialized with CRT - Max concurrency: 1000, Transfer acceleration: {}",
                transferAccelerationEnabled);

        return client;
    }

    /**
     * S3 Presigner for generating presigned URLs
     * Used for client-side direct uploads to S3
     */
    @Bean
    public S3Presigner s3Presigner() {
        log.info("Initializing S3 Presigner for generating presigned URLs");

        return S3Presigner.builder()
                .region(Region.of(awsRegion))
                .credentialsProvider(DefaultCredentialsProvider.create())
                .build();
    }

    /**
     * S3 Transfer Manager for high-level upload operations
     * Built on top of S3AsyncClient, provides automatic multipart handling
     */
    @Bean
    public S3TransferManager s3TransferManager(S3AsyncClient s3AsyncClient) {
        log.info("Initializing S3 Transfer Manager for managed uploads");

        return S3TransferManager.builder()
                .s3Client(s3AsyncClient)
                .build();
    }
}
