/**
 * API Configuration
 */

// Get localhost IP for development (use your machine's local IP when testing on physical devices)
// For development: http://YOUR_LOCAL_IP:8080 (e.g., http://192.168.1.100:8080)
// For production: Your ALB domain
const getApiBaseUrl = () => {
  // Backend is deployed on AWS ECS, accessible via ALB
  // Use the ALB endpoint for both development and production
  return 'http://levantafia-dev-alb-557867530.us-east-1.elb.amazonaws.com';
};

export const API_BASE_URL = getApiBaseUrl();

/**
 * API Endpoints
 */
export const API_ENDPOINTS = {
  PHOTOS: '/api/v1/photos',
  UPLOAD_INIT: '/api/v1/uploads/init',
  UPLOAD_COMPLETE: '/api/v1/uploads/complete',
  DELETE_PHOTOS: '/api/v1/photos',
  CLEANUP_STUCK_UPLOADS: '/api/v1/photos/cleanup-stuck-uploads',
  CLEANUP_ORPHANED: '/api/v1/photos/cleanup-orphaned',
} as const;

/**
 * API Timeout Configuration (in milliseconds)
 */
export const API_TIMEOUT = 30000; // 30 seconds

/**
 * Upload Configuration
 */
export const UPLOAD_CONFIG = {
  MAX_CONCURRENT_UPLOADS: 3,
  CHUNK_SIZE: 1024 * 1024, // 1MB chunks
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 2000, // 2 seconds
} as const;
