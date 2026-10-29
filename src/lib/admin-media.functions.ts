import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  cancelUnregisteredMediaUpload,
  completeMediaUpload,
  createMediaUpload,
  createSignedContactAttachmentUrl,
  deleteMediaAsset,
  getMediaAssetReferences,
  retryEmailOutbox,
} from "@/lib/server/admin-media.server";

const imageType = z.enum(["image/png", "image/jpeg", "image/webp"]);
const createUploadInput = z.object({
  originalName: z.string().trim().min(1).max(180),
  contentType: imageType,
  byteSize: z.number().int().positive().max(15 * 1024 * 1024),
}).strict();
const completeUploadInput = createUploadInput.extend({
  path: z.string().min(1).max(1024),
  altText: z.string().max(300),
  caption: z.string().max(500),
}).strict();
const pathInput = z.object({ path: z.string().min(1).max(1024) }).strict();
const idInput = z.object({ id: z.string().uuid() }).strict();
const attachmentInput = z.object({
  submissionId: z.string().uuid(),
  path: z.string().min(1).max(1024),
}).strict();

export const createMediaUploadFn = createServerFn({ method: "POST" })
  .inputValidator(createUploadInput)
  .handler(async ({ data }) => createMediaUpload(data));

export const completeMediaUploadFn = createServerFn({ method: "POST" })
  .inputValidator(completeUploadInput)
  .handler(async ({ data }) => completeMediaUpload(data));

export const cancelMediaUploadFn = createServerFn({ method: "POST" })
  .inputValidator(pathInput)
  .handler(async ({ data }) => cancelUnregisteredMediaUpload(data));

export const listMediaAssetReferencesFn = createServerFn({ method: "POST" })
  .inputValidator(idInput)
  .handler(async ({ data }) => getMediaAssetReferences(data));

export const deleteMediaAssetFn = createServerFn({ method: "POST" })
  .inputValidator(idInput)
  .handler(async ({ data }) => deleteMediaAsset(data));

export const createSignedContactAttachmentUrlFn = createServerFn({ method: "POST" })
  .inputValidator(attachmentInput)
  .handler(async ({ data }) => createSignedContactAttachmentUrl(data));

export const retryEmailOutboxFn = createServerFn({ method: "POST" })
  .inputValidator(idInput)
  .handler(async ({ data }) => retryEmailOutbox(data));
