package com.levantafia.repository;

import com.levantafia.entity.UploadJob;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

/**
 * Repository for UploadJob entities.
 */
@Repository
public interface UploadJobRepository extends JpaRepository<UploadJob, UUID> {

    /**
     * Find upload jobs by user ID.
     */
    List<UploadJob> findByUserIdOrderByStartedAtDesc(String userId);

    /**
     * Find upload jobs by organization ID.
     */
    List<UploadJob> findByOrganizationIdOrderByStartedAtDesc(String organizationId);

    /**
     * Find upload jobs by status.
     */
    List<UploadJob> findByStatus(UploadJob.UploadJobStatus status);
}
