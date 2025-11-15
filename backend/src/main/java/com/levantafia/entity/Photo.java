package com.levantafia.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

/**
 * Photo entity representing uploaded photos in the database.
 *
 * Each photo is associated with a user and organization, stored in S3,
 * and includes metadata for display and filtering.
 */
@Entity
@Table(name = "photos", indexes = {
    @Index(name = "idx_photos_org_created", columnList = "organization_id, created_at DESC"),
    @Index(name = "idx_photos_user_created", columnList = "user_id, created_at DESC"),
    @Index(name = "idx_photos_s3_key", columnList = "s3_key", unique = true)
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Photo {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "organization_id", nullable = false)
    private String organizationId;

    @Column(name = "s3_key", nullable = false, unique = true, length = 500)
    private String s3Key;

    @Column(name = "filename", nullable = false, length = 255)
    private String filename;

    @Column(name = "size_bytes", nullable = false)
    private Long sizeBytes;

    @Column(name = "width")
    private Integer width;

    @Column(name = "height")
    private Integer height;

    @Column(name = "mime_type", length = 50)
    private String mimeType;

    @Column(name = "upload_job_id")
    private UUID uploadJobId;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "created_by")
    private String createdBy;
}
