package com.levantafia.repository;

import com.levantafia.entity.Photo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repository for Photo entities.
 */
@Repository
public interface PhotoRepository extends JpaRepository<Photo, UUID> {

    /**
     * Find photo by S3 key (unique).
     */
    Optional<Photo> findByS3Key(String s3Key);

    /**
     * Find all photos for a user.
     */
    List<Photo> findByUserIdOrderByCreatedAtDesc(String userId);

    /**
     * Find all photos for an organization.
     */
    List<Photo> findByOrganizationIdOrderByCreatedAtDesc(String organizationId);

    /**
     * Find photos by upload job ID.
     */
    List<Photo> findByUploadJobId(UUID uploadJobId);

    /**
     * Check if photo with S3 key exists.
     */
    boolean existsByS3Key(String s3Key);
}
