import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png';
}

/**
 * Compress and resize an image
 */
export async function compressImage(
  uri: string,
  options: CompressionOptions = {}
): Promise<{ uri: string; width: number; height: number; size: number }> {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.8,
    format = 'jpeg',
  } = options;

  try {
    const manipulated = await manipulateAsync(
      uri,
      [
        {
          resize: {
            width: maxWidth,
            height: maxHeight,
          },
        },
      ],
      {
        compress: quality,
        format: format === 'jpeg' ? SaveFormat.JPEG : SaveFormat.PNG,
      }
    );

    return {
      uri: manipulated.uri,
      width: manipulated.width,
      height: manipulated.height,
      size: 0, // File size would need to be fetched separately
    };
  } catch (error) {
    console.error('Image compression failed:', error);
    throw error;
  }
}

/**
 * Generate thumbnail for an image
 */
export async function generateThumbnail(
  uri: string,
  size: number = 200
): Promise<string> {
  try {
    const manipulated = await manipulateAsync(
      uri,
      [
        {
          resize: {
            width: size,
            height: size,
          },
        },
      ],
      {
        compress: 0.7,
        format: SaveFormat.JPEG,
      }
    );

    return manipulated.uri;
  } catch (error) {
    console.error('Thumbnail generation failed:', error);
    return uri; // Return original if thumbnail generation fails
  }
}

/**
 * Calculate optimal compression settings based on file size
 */
export function getOptimalCompressionSettings(
  fileSizeBytes: number
): CompressionOptions {
  // Files under 1MB: minimal compression
  if (fileSizeBytes < 1024 * 1024) {
    return {
      maxWidth: 2048,
      maxHeight: 2048,
      quality: 0.9,
    };
  }

  // Files under 5MB: moderate compression
  if (fileSizeBytes < 5 * 1024 * 1024) {
    return {
      maxWidth: 1920,
      maxHeight: 1920,
      quality: 0.8,
    };
  }

  // Files over 5MB: aggressive compression
  return {
    maxWidth: 1280,
    maxHeight: 1280,
    quality: 0.7,
  };
}
