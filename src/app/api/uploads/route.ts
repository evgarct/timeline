import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getCurrentUserId } from "@/lib/current-user";

const allowedContentTypes = [
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/png",
  "application/pdf"
];

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json({ error: "Blob storage is not configured" }, { status: 503 });
  }

  const body = await request.json() as HandleUploadBody;
  const response = await handleUpload({
    request,
    body,
    onBeforeGenerateToken: async (pathname) => {
      if (!pathname.startsWith(`users/${userId}/`)) throw new Error("Invalid upload namespace");
      return {
        allowedContentTypes,
        maximumSizeInBytes: 25 * 1024 * 1024,
        addRandomSuffix: true,
        tokenPayload: JSON.stringify({ userId, pathname })
      };
    },
    onUploadCompleted: async () => {
      // The event mutation stores the returned private blob URL after user review.
    }
  });
  return Response.json(response);
}
