package com.levantafia.controller;

import com.levantafia.entity.Photo;
import com.levantafia.entity.PhotoUpload;
import com.levantafia.repository.PhotoRepository;
import com.levantafia.repository.PhotoUploadRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import java.time.Instant;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Photo Controller - API for retrieving uploaded photos
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/photos")
@RequiredArgsConstructor
public class PhotoController {

    private final PhotoRepository photoRepository;
    private final PhotoUploadRepository photoUploadRepository;

    @Value("${cloudfront.domain}")
    private String cloudfrontDomain;

    /**
     * Get all photos for the current user (for now, just get all photos)
     *
     * @return List of photos with CloudFront URLs
     */
    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getAllPhotos() {
        log.info("Fetching all photos");

        List<Photo> photos = photoRepository.findAll();

        List<Map<String, Object>> photoResponses = photos.stream()
                .map(photo -> {
                    Map<String, Object> photoMap = new java.util.HashMap<>();
                    photoMap.put("id", photo.getId().toString());
                    photoMap.put("filename", photo.getFilename());
                    photoMap.put("url", buildCloudfrontUrl(photo.getS3Key()));
                    photoMap.put("sizeBytes", photo.getSizeBytes());
                    photoMap.put("width", photo.getWidth() != null ? photo.getWidth() : 0);
                    photoMap.put("height", photo.getHeight() != null ? photo.getHeight() : 0);
                    photoMap.put("createdAt", photo.getCreatedAt().toString());
                    return photoMap;
                })
                .collect(Collectors.toList());

        log.info("Returning {} photos", photoResponses.size());
        return ResponseEntity.ok(photoResponses);
    }

    /**
     * Delete selected photos by their IDs
     *
     * @param photoIds List of photo IDs to delete
     * @return Count of deleted photos
     */
    @DeleteMapping
    @Transactional
    public ResponseEntity<Map<String, Object>> deletePhotos(@RequestBody Map<String, List<String>> request) {
        List<String> photoIds = request.get("photoIds");

        if (photoIds == null || photoIds.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "No photo IDs provided",
                    "deletedCount", 0
            ));
        }

        log.info("Deleting {} photos", photoIds.size());

        int deletedCount = 0;
        for (String photoIdStr : photoIds) {
            try {
                java.util.UUID photoId = java.util.UUID.fromString(photoIdStr);
                photoRepository.deleteById(photoId);
                deletedCount++;
            } catch (IllegalArgumentException e) {
                log.warn("Invalid photo ID: {}", photoIdStr);
            }
        }

        log.info("Successfully deleted {} photos", deletedCount);

        return ResponseEntity.ok(Map.of(
                "deletedCount", deletedCount,
                "failedCount", photoIds.size() - deletedCount
        ));
    }

    /**
     * Clean up orphaned photos that don't have a COMPLETED PhotoUpload record
     * This happens when uploads fail after Photo record is created but before PhotoUpload is updated
     *
     * @return Count of deleted photos
     */
    @DeleteMapping("/cleanup-orphaned")
    @Transactional
    public ResponseEntity<Map<String, Object>> cleanupOrphanedPhotos() {
        log.info("Starting cleanup of orphaned photos");

        // Find all photos
        List<Photo> allPhotos = photoRepository.findAll();
        log.info("Found {} total photos", allPhotos.size());

        // Find photos that don't have a corresponding COMPLETED PhotoUpload
        List<Photo> orphanedPhotos = allPhotos.stream()
                .filter(photo -> {
                    List<PhotoUpload> uploads = photoUploadRepository.findAll().stream()
                            .filter(pu -> photo.getId().equals(pu.getPhotoId())
                                    && pu.getStatus() == PhotoUpload.PhotoUploadStatus.COMPLETED)
                            .toList();
                    return uploads.isEmpty();
                })
                .toList();

        log.info("Found {} orphaned photos to delete", orphanedPhotos.size());

        // Delete orphaned photos
        photoRepository.deleteAll(orphanedPhotos);

        log.info("Deleted {} orphaned photos", orphanedPhotos.size());

        return ResponseEntity.ok(Map.of(
                "deletedCount", orphanedPhotos.size(),
                "remainingCount", allPhotos.size() - orphanedPhotos.size()
        ));
    }

    /**
     * Cleanup stuck upload jobs (INITIATED or UPLOADING for > 1 hour)
     * This endpoint deletes PhotoUpload records that are stuck in pending states
     *
     * @return Count of deleted upload jobs
     */
    @DeleteMapping("/cleanup-stuck-uploads")
    @Transactional
    public ResponseEntity<Map<String, Object>> cleanupStuckUploads() {
        log.info("Starting cleanup of stuck upload jobs");

        // Find uploads stuck in INITIATED or UPLOADING for more than 1 hour
        Instant oneHourAgo = Instant.now().minusSeconds(3600);

        List<PhotoUpload> stuckUploads = photoUploadRepository.findAll().stream()
                .filter(upload -> {
                    boolean isStuckStatus = upload.getStatus() == PhotoUpload.PhotoUploadStatus.INITIATED
                            || upload.getStatus() == PhotoUpload.PhotoUploadStatus.UPLOADING;
                    boolean isOld = upload.getCreatedAt().isBefore(oneHourAgo);
                    return isStuckStatus && isOld;
                })
                .toList();

        log.info("Found {} stuck uploads to delete", stuckUploads.size());

        // Delete stuck uploads
        photoUploadRepository.deleteAll(stuckUploads);

        log.info("Deleted {} stuck upload jobs", stuckUploads.size());

        return ResponseEntity.ok(Map.of(
                "deletedCount", stuckUploads.size(),
                "message", String.format("Deleted %d stuck upload jobs", stuckUploads.size())
        ));
    }

    /**
     * Build CloudFront URL from S3 key
     */
    private String buildCloudfrontUrl(String s3Key) {
        return String.format("https://%s/%s", cloudfrontDomain, s3Key);
    }
}
