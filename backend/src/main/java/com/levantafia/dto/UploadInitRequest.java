package com.levantafia.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class UploadInitRequest {

    @NotBlank(message = "Filename is required")
    @Size(max = 255, message = "Filename must not exceed 255 characters")
    private String filename;

    @NotNull(message = "File size is required")
    @Min(value = 1, message = "File size must be greater than 0")
    @Max(value = 52428800, message = "File size must not exceed 50MB")
    private Long fileSizeBytes;

    @NotBlank(message = "Content type is required")
    @Pattern(regexp = "image/(jpeg|png|webp|heic|heif)",
            message = "Only image files are allowed (JPEG, PNG, WebP, HEIC, HEIF)")
    private String contentType;
}
