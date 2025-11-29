import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AppSyncResolverEvent } from 'aws-lambda';

const s3Client = new S3Client({});
const BUCKET_NAME = process.env.PROFILE_PICTURES_BUCKET_NAME!;

const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

interface GenerateUploadUrlArgs {
    filename: string;
    contentType: string;
}

interface GenerateUploadUrlResult {
    uploadUrl: string;
    key: string;
    expiresIn: number;
}

export const handler = async (event: AppSyncResolverEvent<GenerateUploadUrlArgs>): Promise<GenerateUploadUrlResult> => {
    const identity = event.identity as { sub?: string };
    const userId = identity?.sub;

    if (!userId) {
        throw new Error('Unauthorized');
    }

    const { filename, contentType } = event.arguments;

    if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
        throw new Error(`Unsupported image format. Allowed: ${ALLOWED_CONTENT_TYPES.join(', ')}`);
    }

    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const timestamp = Date.now();
    const key = `${userId}/${timestamp}-${sanitizedFilename}`;

    const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        ContentType: contentType,
    });

    const expiresIn = 300;
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn });

    return { uploadUrl, key, expiresIn };
};
