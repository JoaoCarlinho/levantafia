package com.levantafia.config;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Gauge;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Monitors Virtual Thread performance metrics
 * Tracks concurrent virtual threads and performance indicators
 */
@Slf4j
@Component
public class VirtualThreadMonitor {

    private final MeterRegistry meterRegistry;
    private volatile long activeVirtualThreads = 0;
    private volatile long peakVirtualThreads = 0;

    @Autowired
    public VirtualThreadMonitor(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
        registerMetrics();
    }

    private void registerMetrics() {
        // Register gauges for virtual thread metrics
        Gauge.builder("jvm.threads.virtual.active", this, VirtualThreadMonitor::getActiveVirtualThreads)
                .description("Active virtual threads")
                .register(meterRegistry);

        Gauge.builder("jvm.threads.virtual.peak", this, VirtualThreadMonitor::getPeakVirtualThreads)
                .description("Peak virtual threads")
                .register(meterRegistry);
    }

    @Scheduled(fixedRate = 5000) // Every 5 seconds
    public void logVirtualThreadStats() {
        Thread.getAllStackTraces().keySet().stream()
                .filter(Thread::isVirtual)
                .count();

        long current = countVirtualThreads();
        activeVirtualThreads = current;

        if (current > peakVirtualThreads) {
            peakVirtualThreads = current;
        }

        if (log.isDebugEnabled()) {
            log.debug("Virtual Threads - Active: {}, Peak: {}", current, peakVirtualThreads);
        }
    }

    private long countVirtualThreads() {
        return Thread.getAllStackTraces().keySet().stream()
                .filter(Thread::isVirtual)
                .count();
    }

    public long getActiveVirtualThreads() {
        return activeVirtualThreads;
    }

    public long getPeakVirtualThreads() {
        return peakVirtualThreads;
    }
}
