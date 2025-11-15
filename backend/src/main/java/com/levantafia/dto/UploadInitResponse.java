package com.levantafia.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
@Builder
public class UploadInitResponse {
    private UUID uploadId;
    private String s3Key;
    private String multipartUploadId;
    private boolean multipart;
    private Long partSize;
    private Integer numberOfParts;
    private List<String> presignedUrls;
    private int expiresInMinutes;
}
