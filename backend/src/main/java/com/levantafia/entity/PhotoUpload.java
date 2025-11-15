package com.levantafia.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

/**
 * PhotoUpload entity tracks individual photo upload operations.
 *
 * Each record represents one photo being uploaded to S3.
 * Used for tracking upload progress, multipart upload state, and eventual photo creation.
 */
@Entity
@Table(name = "photo_uploads", indexes = {
    @Index(name = "idx_photo_uploads_status", columnList = "status, created_at DESC"),
    @Index(name = "idx_photo_uploads_user", columnList = "user_id, created_at DESC")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PhotoUpload {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    @Builder.Default
    private String userId = "anonymous";  // Default for now, will be updated with auth

    @Column(name = "organization_id")
    @Builder.Default
    private String organizationId = "default";  // Default for now

    @Column(name = "filename", nullable = false, length = 255)
    private String filename;

    @Column(name = "file_size_bytes", nullable = false)
    private Long fileSizeBytes;

    @Column(name = "content_type", length = 100)
    private String contentType;

    @Column(name = "s3_key", nullable = false, length = 500)
    private String s3Key;

    @Column(name = "multipart_upload_id", length = 500)
    private String multipartUploadId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private PhotoUploadStatus status = PhotoUploadStatus.INITIATED;

    @Column(name = "progress")
    @Builder.Default
    private Integer progress = 0;

    @Column(name = "photo_id")
    private UUID photoId;

    @Column(name = "error_message", length = 1000)
    private String errorMessage;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;

    /**
     * Photo upload status enum.
     */
    public enum PhotoUploadStatus {
        INITIATED,      // Upload initialized, presigned URLs generated
        UPLOADING,      // Client is uploading to S3
        COMPLETING,     // Finalizing multipart upload
        COMPLETED,      // Upload successful, photo created
        FAILED,         // Upload failed
        ABORTED         // Upload cancelled by user
    }
}
