import { useState, useRef, useCallback } from 'react';
import { generateClient } from 'aws-amplify/api';
import { validateFileType, validateFileSize, generatePreview } from '../utils/fileValidation';
import { generateProfilePictureUploadUrl } from '../graphql/mutations';
import './ProfilePictureUpload.css';

interface ProfilePictureUploadProps {
    onUploadComplete: () => void;
    onCancel: () => void;
}

interface UploadUrlResponse {
    generateProfilePictureUploadUrl: {
        uploadUrl: string;
        key: string;
        expiresIn: number;
    };
}

export function ProfilePictureUpload({ onUploadComplete, onCancel }: ProfilePictureUploadProps) {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const validateAndSetFile = useCallback(async (file: File) => {
        setError(null);

        const typeResult = validateFileType(file);
        if (!typeResult.valid) {
            setError(typeResult.error!);
            return;
        }

        const sizeResult = validateFileSize(file);
        if (!sizeResult.valid) {
            setError(sizeResult.error!);
            return;
        }

        try {
            const preview = await generatePreview(file);
            setSelectedFile(file);
            setPreviewUrl(preview);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to read file');
        }
    }, []);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) validateAndSetFile(file);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) validateAndSetFile(file);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleUpload = async () => {
        if (!selectedFile) return;

        setUploading(true);
        setProgress(0);
        setError(null);

        try {
            const client = generateClient();
            const response = await client.graphql({
                query: generateProfilePictureUploadUrl,
                variables: {
                    filename: selectedFile.name,
                    contentType: selectedFile.type,
                },
            }) as { data: UploadUrlResponse };

            const { uploadUrl } = response.data.generateProfilePictureUploadUrl;

            // Upload to S3 with progress tracking
            await new Promise<void>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        setProgress(Math.round((e.loaded / e.total) * 100));
                    }
                });
                xhr.addEventListener('load', () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve();
                    } else {
                        reject(new Error('Failed to upload image'));
                    }
                });
                xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
                xhr.open('PUT', uploadUrl);
                xhr.setRequestHeader('Content-Type', selectedFile.type);
                xhr.send(selectedFile);
            });

            onUploadComplete();
        } catch (err) {
            console.error('Upload error:', err);
            setError(err instanceof Error ? err.message : 'Failed to upload image. Please try again');
            setUploading(false);
        }
    };

    const handleClear = () => {
        setSelectedFile(null);
        setPreviewUrl(null);
        setError(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="profile-picture-upload">
            {!previewUrl ? (
                <div
                    className={`upload-dropzone ${isDragging ? 'dragging' : ''}`}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={handleFileSelect}
                        hidden
                    />
                    <div className="dropzone-content">
                        <span className="dropzone-icon">📷</span>
                        <p>Drag and drop an image here, or click to select</p>
                        <p className="dropzone-hint">JPEG, PNG, WebP, or GIF • Max 5MB</p>
                    </div>
                </div>
            ) : (
                <div className="preview-container">
                    <div className="preview-image-wrapper">
                        <img src={previewUrl} alt="Preview" className="preview-image" />
                    </div>
                    {uploading && (
                        <div className="upload-progress">
                            <div className="progress-bar" style={{ width: `${progress}%` }} />
                            <span className="progress-text">{progress}%</span>
                        </div>
                    )}
                </div>
            )}

            {error && <div className="upload-error">{error}</div>}

            <div className="upload-actions">
                <button type="button" onClick={onCancel} className="btn-secondary" disabled={uploading}>
                    Cancel
                </button>
                {previewUrl && !uploading && (
                    <button type="button" onClick={handleClear} className="btn-secondary">
                        Choose Different
                    </button>
                )}
                {previewUrl && (
                    <button type="button" onClick={handleUpload} className="btn-primary" disabled={uploading}>
                        {uploading ? 'Uploading...' : 'Upload'}
                    </button>
                )}
            </div>
        </div>
    );
}
