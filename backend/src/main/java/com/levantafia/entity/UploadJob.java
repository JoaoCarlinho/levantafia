package com.levantafia.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

/**
 * UploadJob entity tracks batch photo upload operations.
 *
 * Used to track progress of bulk upload operations and provide
 * aggregate statistics for completed uploads.
 */
@Entity
@Table(name = "upload_jobs", indexes = {
    @Index(name = "idx_upload_jobs_user_status", columnList = "user_id, status, started_at DESC")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UploadJob {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "organization_id", nullable = false)
    private String organizationId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private UploadJobStatus status;

    @Column(name = "photo_count", nullable = false)
    private Integer photoCount;

    @Column(name = "completed_count", nullable = false)
    @Builder.Default
    private Integer completedCount = 0;

    @Column(name = "failed_count", nullable = false)
    @Builder.Default
    private Integer failedCount = 0;

    @Column(name = "total_size_bytes")
    private Long totalSizeBytes;

    @CreationTimestamp
    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;

    /**
     * Upload job status enum.
     */
    public enum UploadJobStatus {
        PENDING,
        IN_PROGRESS,
        COMPLETED,
        FAILED,
        CANCELLED
    }
}
