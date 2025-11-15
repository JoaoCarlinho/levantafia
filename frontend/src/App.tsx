import { useState } from 'react'
import { BatchUpload } from './components/BatchUpload'
import { PhotoGallery } from './components/PhotoGallery'
import './App.css'

interface UploadedPhoto {
  uploadId: string;
  filename: string;
  cdnUrl?: string;
  status: 'uploading' | 'completed' | 'failed';
}

function App() {
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([]);

  const handlePhotosUploaded = (photos: UploadedPhoto[]) => {
    setUploadedPhotos(photos);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Levantafia Photo Upload</h1>
        <p>High-performance concurrent photo upload system</p>
      </header>
      <main className="app-main">
        <BatchUpload onPhotosUploaded={handlePhotosUploaded} />
        <PhotoGallery uploadedPhotos={uploadedPhotos} />
      </main>
    </div>
  )
}

export default App
