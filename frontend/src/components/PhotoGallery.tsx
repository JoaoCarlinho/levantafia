import { useState, useEffect } from 'react';
import './PhotoGallery.css';

interface Photo {
  id: string;
  filename: string;
  url: string;
  sizeBytes: number;
  width: number;
  height: number;
  createdAt: string;
  uploadComplete?: boolean;
}

interface PhotoGalleryProps {
  uploadedPhotos: Array<{
    uploadId: string;
    filename: string;
    cdnUrl?: string;
    status: 'uploading' | 'completed' | 'failed';
  }>;
}

export const PhotoGallery: React.FC<PhotoGalleryProps> = ({ uploadedPhotos }) => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchPhotos();
  }, []);

  // Merge uploaded photos with existing photos
  useEffect(() => {
    if (uploadedPhotos.length > 0) {
      const newPhotos = uploadedPhotos
        .filter(up => up.status === 'completed' && up.cdnUrl)
        .map(up => ({
          id: up.uploadId,
          filename: up.filename,
          url: up.cdnUrl!,
          sizeBytes: 0,
          width: 0,
          height: 0,
          createdAt: new Date().toISOString(),
          uploadComplete: true,
        }));

      setPhotos(prev => {
        const existing = prev.filter(p => !newPhotos.some(n => n.id === p.id));
        return [...newPhotos, ...existing];
      });
    }
  }, [uploadedPhotos]);

  const fetchPhotos = async () => {
    try {
      const response = await fetch('/api/v1/photos');
      if (response.ok) {
        const data = await response.json();
        setPhotos(data);
      }
    } catch (error) {
      console.error('Failed to fetch photos:', error);
    } finally {
      setLoading(false);
    }
  };

  const togglePhotoSelection = (photoId: string) => {
    setSelectedPhotoIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(photoId)) {
        newSet.delete(photoId);
      } else {
        newSet.add(photoId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedPhotoIds.size === photos.length) {
      setSelectedPhotoIds(new Set());
    } else {
      setSelectedPhotoIds(new Set(photos.map(p => p.id)));
    }
  };

  const deleteSelectedPhotos = async () => {
    if (selectedPhotoIds.size === 0) return;

    const confirmDelete = window.confirm(
      `Are you sure you want to delete ${selectedPhotoIds.size} photo(s)?`
    );

    if (!confirmDelete) return;

    setDeleting(true);

    try {
      const response = await fetch('/api/v1/photos', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          photoIds: Array.from(selectedPhotoIds),
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`Deleted ${result.deletedCount} photos`);

        // Remove deleted photos from state
        setPhotos(prev => prev.filter(p => !selectedPhotoIds.has(p.id)));
        setSelectedPhotoIds(new Set());
      } else {
        console.error('Failed to delete photos');
        alert('Failed to delete photos. Please try again.');
      }
    } catch (error) {
      console.error('Error deleting photos:', error);
      alert('Error deleting photos. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading && photos.length === 0) {
    return <div className="photo-gallery-loading">Loading photos...</div>;
  }

  if (photos.length === 0) {
    return (
      <div className="photo-gallery-empty">
        <p>No photos uploaded yet. Start uploading to see them here!</p>
      </div>
    );
  }

  return (
    <div className="photo-gallery">
      <div className="photo-gallery-header">
        <div>
          <h2>Photo Gallery</h2>
          <p className="photo-count">
            {photos.length} photo{photos.length !== 1 ? 's' : ''} uploaded
            {selectedPhotoIds.size > 0 && (
              <span className="selection-count">
                {' '}• {selectedPhotoIds.size} selected
              </span>
            )}
          </p>
        </div>
        {photos.length > 0 && (
          <div className="photo-actions">
            <label className="select-all-checkbox">
              <input
                type="checkbox"
                checked={selectedPhotoIds.size === photos.length && photos.length > 0}
                onChange={toggleSelectAll}
              />
              <span>Select All</span>
            </label>
            <button
              className="delete-button"
              onClick={deleteSelectedPhotos}
              disabled={selectedPhotoIds.size === 0 || deleting}
            >
              {deleting ? 'Deleting...' : `Delete (${selectedPhotoIds.size})`}
            </button>
          </div>
        )}
      </div>
      <div className="photo-grid">
        {photos.map((photo) => (
          <div
            key={photo.id}
            className={`photo-card ${selectedPhotoIds.has(photo.id) ? 'selected' : ''}`}
          >
            <div className="photo-selection">
              <input
                type="checkbox"
                checked={selectedPhotoIds.has(photo.id)}
                onChange={() => togglePhotoSelection(photo.id)}
                className="photo-checkbox"
              />
            </div>
            <div className="photo-image-container">
              <img
                src={photo.url}
                alt={photo.filename}
                className="photo-image"
                loading="lazy"
              />
              {photo.uploadComplete && (
                <div className="photo-upload-complete">
                  <svg
                    className="checkmark"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
              )}
            </div>
            <div className="photo-info">
              <p className="photo-filename" title={photo.filename}>
                {photo.filename}
              </p>
              <p className="photo-meta">
                {(photo.sizeBytes / 1024 / 1024).toFixed(2)} MB
                {photo.width > 0 && photo.height > 0 && (
                  <span> • {photo.width} × {photo.height}</span>
                )}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
