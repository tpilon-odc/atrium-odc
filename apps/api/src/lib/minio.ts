import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
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

// URL de téléchargement — retourne une URL API proxy plutôt qu'une URL presignée MinIO directe
// logos/ et avatars/ → /public/ (sans auth, utilisés dans <img> y compris pages publiques)
// Tout le reste → /private/ (JWT requis)
export function getPresignedUrl(key: string, _ttlSeconds = 3600): Promise<string> {
  const apiBase = (process.env.API_URL || 'http://localhost:3001/api').replace(/\/api$/, '')
  const isPublic = key.startsWith('logos/') || key.startsWith('avatars/')
  const visibility = isPublic ? 'public' : 'private'
  return Promise.resolve(`${apiBase}/api/v1/files/${visibility}/${key}`)
}
