package com.levantafia.dto;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class UploadStatusResponse {
    private UUID uploadId;
    private String filename;
    private String status;
    private Integer progress;
    private Instant createdAt;
    private Instant completedAt;
}
