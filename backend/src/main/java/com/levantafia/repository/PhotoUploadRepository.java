package com.levantafia.repository;

import com.levantafia.entity.PhotoUpload;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PhotoUploadRepository extends JpaRepository<PhotoUpload, UUID> {

    /**
     * Native SQL query to bypass EntityManager cache and query database directly
     * This ensures we always get fresh data from PostgreSQL
     */
    @Query(value = "SELECT * FROM photo_uploads WHERE id = :id", nativeQuery = true)
    Optional<PhotoUpload> findByIdNative(@Param("id") UUID id);

    /**
     * Update PhotoUpload status using direct UPDATE query (no SELECT first)
     * This avoids the PostgreSQL snapshot isolation issue by not querying the record
     *
     * @param uploadId Upload ID
     * @param status New status
     * @param progress Progress percentage
     * @param photoId Photo ID created
     * @param completedAt Completion timestamp
     * @return Number of rows updated (should be 1)
     */
    @Modifying
    @Query(value = """
            UPDATE photo_uploads
            SET status = CAST(:status AS text),
                progress = :progress,
                photo_id = :photoId,
                completed_at = :completedAt,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = :uploadId
            """, nativeQuery = true)
    int updatePhotoUploadStatus(
            @Param("uploadId") UUID uploadId,
            @Param("status") PhotoUpload.PhotoUploadStatus status,
            @Param("progress") Integer progress,
            @Param("photoId") UUID photoId,
            @Param("completedAt") Instant completedAt
    );
}
