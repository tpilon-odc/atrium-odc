import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Client as MinioNativeClient } from 'minio'
import { randomUUID } from 'crypto'

if (process.env.NODE_ENV === 'production') {
  const required = ['MINIO_ACCESS_KEY', 'MINIO_SECRET_KEY', 'MINIO_ENDPOINT', 'MINIO_BUCKET']
  for (const key of required) {
    if (!process.env[key]) throw new Error(`Variable d'environnement manquante : ${key}`)
  }
}

// AWS SDK — utilisé pour upload/delete
export const s3 = new S3Client({
  endpoint: `http://${process.env.MINIO_ENDPOINT || 'localhost'}:${process.env.MINIO_PORT || '9000'}`,
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretAccessKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
  },
  forcePathStyle: true,
})

// Client MinIO natif — utilisé pour les opérations serveur (getObject, listObjects, removeObjects)
export const minioNative = new MinioNativeClient({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
})

// Client S3 public — utilisé pour les URLs presignées, pointe vers l'URL publique
const s3PublicEndpoint = process.env.MINIO_PUBLIC_URL
  || `http://${process.env.MINIO_ENDPOINT || 'localhost'}:${process.env.MINIO_PORT || '9000'}`

export const s3Public = new S3Client({
  endpoint: s3PublicEndpoint,
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretAccessKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
  },
  forcePathStyle: true,
})

export const BUCKET = process.env.MINIO_BUCKET || 'cgp-documents'

// Types MIME autorisés — validation côté serveur (specs section 10)
export const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
])

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

// Sanitize le nom de fichier pour éviter le path traversal
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/\.\./g, '')
    .replace(/[/\\]/g, '')
    .replace(/[^a-zA-Z0-9._\-\u00C0-\u017E ]/g, '_')
    .substring(0, 200)
    .trim() || 'fichier'
}

// Génère le chemin de stockage : cabinets/{cabinetId}/{uuid}/{filename}
export function buildStoragePath(cabinetId: string, filename: string): string {
  return `cabinets/${cabinetId}/${randomUUID()}/${sanitizeFilename(filename)}`
}

export async function uploadToMinio(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  )
}

export async function deleteFromMinio(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
}

// URL de téléchargement presignée — expire après ttlSeconds (défaut 1h)
// Utilise s3Public qui pointe vers MINIO_PUBLIC_URL pour que la signature soit valide depuis le navigateur
export async function getPresignedUrl(key: string, ttlSeconds = 3600): Promise<string> {
  return getSignedUrl(s3Public, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: ttlSeconds })
}
