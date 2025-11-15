package com.levantafia.config;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Metrics Configuration for Performance Monitoring
 *
 * Tracks critical performance metrics for the upload system:
 * - Upload throughput (uploads/second)
 * - Upload duration (p50, p95, p99)
 * - Virtual thread utilization
 * - S3 multipart upload performance
 * - Success/failure rates
 *
 * These metrics are exposed via /actuator/prometheus for monitoring
 */
@Configuration
public class MetricsConfig {

    /**
     * Upload performance timer
     * Tracks end-to-end upload duration from init to complete
     */
    @Bean
    public Timer uploadPerformanceTimer(MeterRegistry registry) {
        return Timer.builder("upload.performance")
                .description("End-to-end upload performance")
                .tag("type", "total")
                .publishPercentiles(0.5, 0.95, 0.99) // p50, p95, p99
                .register(registry);
    }

    /**
     * Concurrent upload counter
     * Tracks number of simultaneous uploads being processed
     */
    @Bean
    public Counter concurrentUploadsCounter(MeterRegistry registry) {
        return Counter.builder("upload.concurrent")
                .description("Number of concurrent uploads")
                .register(registry);
    }

    /**
     * Upload throughput gauge
     * Tracks uploads completed per second
     */
    @Bean
    public Counter uploadThroughputCounter(MeterRegistry registry) {
        return Counter.builder("upload.throughput")
                .description("Uploads completed per second")
                .register(registry);
    }

    /**
     * Multipart upload metrics
     */
    @Bean
    public Timer multipartUploadTimer(MeterRegistry registry) {
        return Timer.builder("upload.multipart.duration")
                .description("Duration of multipart uploads")
                .publishPercentiles(0.5, 0.95, 0.99)
                .register(registry);
    }

    /**
     * S3 operation metrics
     */
    @Bean
    public Timer s3OperationTimer(MeterRegistry registry) {
        return Timer.builder("s3.operation.duration")
                .description("S3 operation duration")
                .publishPercentiles(0.5, 0.95, 0.99)
                .register(registry);
    }
}
