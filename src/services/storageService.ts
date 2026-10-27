import { Storage } from "@google-cloud/storage";

import { getEnv } from "../config/env";
import { StorageError } from "../lib/errors";
import { logger as rootLogger, type Logger } from "../lib/logger";

export interface StoredObject {
  path: string;
  publicUrl: string;
}

export interface StorageService {
  readonly bucketName: string;
  getPublicUrl(path: string): string;
  exists(path: string): Promise<boolean>;
  /** Returns the first object whose name starts with `prefix`, or null. */
  findByPrefix(prefix: string): Promise<StoredObject | null>;
  uploadImage(
    path: string,
    data: Buffer,
    contentType: string,
    metadata?: Record<string, string>,
  ): Promise<StoredObject>;
  download(path: string): Promise<Buffer>;
  delete(path: string): Promise<void>;
}

export interface StorageServiceDeps {
  bucketName: string;
  storage: Storage;
  logger?: Logger;
}

/**
 * Thin wrapper around Google Cloud Storage. Used exclusively for AI-generated
 * content; origin images (Unsplash) are never proxied through the bucket.
 */
export function createStorageService({
  bucketName,
  storage,
  logger = rootLogger.child("storageService"),
}: StorageServiceDeps): StorageService {
  const bucket = storage.bucket(bucketName);

  const getPublicUrl = (path: string) =>
    `https://storage.googleapis.com/${bucketName}/${path.split("/").map(encodeURIComponent).join("/")}`;

  async function wrap<T>(operation: string, path: string, fn: () => Promise<T>): Promise<T> {
    const startedAt = performance.now();
    try {
      const result = await fn();
      logger.debug(`${operation} ok`, { path, ms: Math.round(performance.now() - startedAt) });
      return result;
    } catch (cause) {
      throw new StorageError(`GCS ${operation} failed for "${path}" in bucket "${bucketName}"`, {
        cause,
        details: { operation, path, bucket: bucketName },
      });
    }
  }

  return {
    bucketName,
    getPublicUrl,

    exists: (path) => wrap("exists", path, async () => (await bucket.file(path).exists())[0]),

    findByPrefix: (prefix) =>
      wrap("findByPrefix", prefix, async () => {
        const [files] = await bucket.getFiles({ prefix, maxResults: 1 });
        const file = files[0];
        return file ? { path: file.name, publicUrl: getPublicUrl(file.name) } : null;
      }),

    uploadImage: (path, data, contentType, metadata) =>
      wrap("upload", path, async () => {
        await bucket.file(path).save(data, {
          resumable: false,
          contentType,
          metadata: {
            cacheControl: "public, max-age=31536000, immutable",
            metadata,
          },
        });
        return { path, publicUrl: getPublicUrl(path) };
      }),

    download: (path) => wrap("download", path, async () => (await bucket.file(path).download())[0]),

    delete: (path) =>
      wrap("delete", path, async () => {
        await bucket.file(path).delete({ ignoreNotFound: true });
      }),
  };
}

let instance: StorageService | undefined;

/** Lazily-created singleton wired to the validated environment. */
export function getStorageService(): StorageService {
  if (!instance) {
    const env = getEnv();
    instance = createStorageService({
      bucketName: env.GCS_BUCKET_NAME,
      storage: new Storage({
        projectId: env.GCS_PROJECT_ID,
        keyFilename: env.GOOGLE_APPLICATION_CREDENTIALS,
      }),
    });
  }
  return instance;
}
