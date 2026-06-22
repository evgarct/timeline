import "server-only";
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const accountId = process.env.R2_ACCOUNT_ID;
const configuredEndpoint = process.env.R2_ENDPOINT;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
export const r2BucketName = process.env.R2_BUCKET_NAME;

const endpoint = configuredEndpoint ?? (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);

export const isR2Configured = Boolean(endpoint && accessKeyId && secretAccessKey && r2BucketName);

const client = isR2Configured
  ? new S3Client({
      region: "auto",
      endpoint,
      credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! }
    })
  : null;

function configuredClient() {
  if (!client || !r2BucketName) throw new Error("R2 storage is not configured");
  return client;
}

export async function createUploadUrl(key: string, contentType: string) {
  return getSignedUrl(configuredClient(), new PutObjectCommand({
    Bucket: r2BucketName,
    Key: key,
    ContentType: contentType
  }), { expiresIn: 10 * 60 });
}

export async function createDownloadUrl(key: string) {
  return getSignedUrl(configuredClient(), new GetObjectCommand({
    Bucket: r2BucketName,
    Key: key
  }), { expiresIn: 60 * 60 });
}

export async function headObject(key: string) {
  return configuredClient().send(new HeadObjectCommand({ Bucket: r2BucketName, Key: key }));
}

export async function readObjectPrefix(key: string, byteCount = 16) {
  const result = await configuredClient().send(new GetObjectCommand({
    Bucket: r2BucketName,
    Key: key,
    Range: `bytes=0-${byteCount - 1}`
  }));
  return new Uint8Array(await result.Body!.transformToByteArray());
}

export async function getObject(key: string) {
  return configuredClient().send(new GetObjectCommand({ Bucket: r2BucketName, Key: key }));
}

export async function deleteObjects(keys: string[]) {
  if (!keys.length) return;
  await configuredClient().send(new DeleteObjectsCommand({
    Bucket: r2BucketName,
    Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true }
  }));
}
