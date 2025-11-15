package com.levantafia.dto;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class UploadCompleteResponse {
    private UUID uploadId;
    private String s3Key;
    private String status;
    private UUID photoId;
    private String cdnUrl;
    private String filename;
}
