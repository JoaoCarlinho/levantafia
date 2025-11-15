package com.levantafia.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class UploadCompleteRequest {

    @NotNull(message = "Upload ID is required")
    private UUID uploadId;

    @NotNull(message = "S3 key is required")
    private String s3Key;

    @NotNull(message = "Filename is required")
    private String filename;

    @NotNull(message = "File size is required")
    private Long fileSizeBytes;

    @NotNull(message = "Content type is required")
    private String contentType;

    private String multipartUploadId;  // Optional - only for multipart uploads

    @NotEmpty(message = "At least one ETag is required")
    private List<String> partETags;
}
