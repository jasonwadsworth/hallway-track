const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export interface ValidationResult {
    valid: boolean;
    error?: string;
}

export function validateFileType(file: File): ValidationResult {
    if (!ALLOWED_TYPES.includes(file.type)) {
        return { valid: false, error: 'Please select a valid image file (JPEG, PNG, WebP, or GIF)' };
    }
    return { valid: true };
}

export function validateFileSize(file: File): ValidationResult {
    if (file.size > MAX_SIZE_BYTES) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        return { valid: false, error: `Image file must be smaller than 5MB. Your file is ${sizeMB}MB` };
    }
    return { valid: true };
}

export function generatePreview(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Unable to read the selected file. Please try again'));
        reader.readAsDataURL(file);
    });
}
