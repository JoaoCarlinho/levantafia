package com.levantafia.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.AsyncTaskExecutor;
import org.springframework.core.task.support.TaskExecutorAdapter;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.web.servlet.config.annotation.AsyncSupportConfigurer;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.concurrent.Executors;

/**
 * Virtual Threads Configuration for Java 21+
 *
 * This configuration enables Project Loom's Virtual Threads for handling
 * high-concurrency upload operations. Virtual threads are lightweight,
 * allowing us to handle 100+ concurrent uploads without the overhead
 * of traditional platform threads.
 *
 * Performance Benefits:
 * - Traditional threads: ~1MB stack per thread = 100MB for 100 threads
 * - Virtual threads: ~1KB stack per thread = 100KB for 100 threads
 * - No thread pool limits - can scale to millions of virtual threads
 * - Automatic yielding during I/O operations (S3 uploads)
 *
 * Target: Upload 100 photos (2MB each) in < 10 seconds
 * - With Virtual Threads: All 100 uploads run truly concurrently
 * - No thread pool saturation
 * - No context switching overhead
 */
@Slf4j
@Configuration
@EnableAsync
public class VirtualThreadConfig implements WebMvcConfigurer {

    /**
     * Virtual Thread Executor for async operations
     * This executor is used for @Async methods and can handle unlimited concurrency
     */
    @Bean(name = "virtualThreadExecutor")
    public AsyncTaskExecutor virtualThreadExecutor() {
        log.info("Initializing Virtual Thread Executor for high-concurrency uploads");

        // Create a virtual thread executor
        // Unlike traditional ThreadPoolExecutor, this has no pool limit
        var executor = Executors.newVirtualThreadPerTaskExecutor();

        return new TaskExecutorAdapter(executor);
    }

    /**
     * Configure Spring MVC to use Virtual Threads for async request processing
     * This enables non-blocking handling of upload requests
     */
    @Override
    public void configureAsyncSupport(AsyncSupportConfigurer configurer) {
        configurer.setTaskExecutor(virtualThreadExecutor());
        configurer.setDefaultTimeout(120000); // 2 minutes timeout

        log.info("Spring MVC configured to use Virtual Threads for async request handling");
    }

    /**
     * Virtual Thread Executor specifically for S3 upload operations
     * Optimized for I/O-bound tasks with automatic yielding
     */
    @Bean(name = "s3UploadExecutor")
    public AsyncTaskExecutor s3UploadExecutor() {
        log.info("Initializing S3 Upload Virtual Thread Executor");

        // Virtual threads are perfect for S3 uploads because:
        // 1. S3 uploads are I/O bound (waiting for network)
        // 2. Virtual threads automatically yield during I/O
        // 3. Can run hundreds of uploads concurrently without memory issues
        var executor = Executors.newVirtualThreadPerTaskExecutor();

        return new TaskExecutorAdapter(executor);
    }

    /**
     * Performance monitoring - logs virtual thread statistics
     */
    @Bean
    public VirtualThreadMonitor virtualThreadMonitor(io.micrometer.core.instrument.MeterRegistry meterRegistry) {
        return new VirtualThreadMonitor(meterRegistry);
    }
}
