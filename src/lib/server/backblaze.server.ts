import { createHash, createHmac } from "node:crypto";

export type BackblazeConfig = {
  endpoint: string;
  bucket: string;
  region: string;
  keyId: string;
  applicationKey: string;
};

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

export function getBackblazeConfig(): BackblazeConfig | null {
  const endpoint = env("BACKBLAZE_S3_ENDPOINT").replace(/\/+$/, "");
  const bucket = env("BACKBLAZE_S3_BUCKET");
  const keyId = env("BACKBLAZE_S3_KEY_ID");
  const applicationKey = env("BACKBLAZE_S3_APPLICATION_KEY");
  const region = env("BACKBLAZE_S3_REGION") || "eu-central-003";
  if (!endpoint || !bucket || !keyId || !applicationKey) return null;
  try {
    const parsed = new URL(endpoint);
    if (parsed.protocol !== "https:" || parsed.pathname !== "/") return null;
  } catch {
    return null;
  }
  if (!/^[a-z0-9.-]{3,63}$/.test(bucket)) return null;
  return { endpoint, bucket, region, keyId, applicationKey };
}

function encode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

function encodePath(value: string): string {
  return value.split("/").map(encode).join("/");
}

function hmac(key: Uint8Array | string, value: string): Uint8Array {
  return createHmac("sha256", key).update(value).digest();
}

function hex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

function canonicalQuery(values: Record<string, string>): string {
  return Object.entries(values)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encode(key)}=${encode(value)}`)
    .join("&");
}

function signedUrl(config: BackblazeConfig, method: "GET" | "PUT" | "HEAD" | "DELETE", key: string, contentType?: string, expires = "900"): string {
  const host = new URL(config.endpoint).host;
  const pathname = `/${encode(config.bucket)}/${encodePath(key)}`;
  const amzDate = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const shortDate = amzDate.slice(0, 8);
  const scope = `${shortDate}/${config.region}/s3/aws4_request`;
  const signedHeaders = contentType ? "content-type;host" : "host";
  const canonicalHeaders = contentType ? `content-type:${contentType}\nhost:${host}\n` : `host:${host}\n`;
  const query = canonicalQuery({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${config.keyId}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": expires,
    "X-Amz-SignedHeaders": signedHeaders,
  });
  const canonicalRequest = `${method}\n${pathname}\n${query}\n${canonicalHeaders}\n${signedHeaders}\nUNSIGNED-PAYLOAD`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${createHash("sha256").update(canonicalRequest).digest("hex")}`;
  const dateKey = hmac(`AWS4${config.applicationKey}`, shortDate);
  const regionKey = hmac(dateKey, config.region);
  const serviceKey = hmac(regionKey, "s3");
  const signingKey = hmac(serviceKey, "aws4_request");
  const signature = hex(hmac(signingKey, stringToSign));
  return `${config.endpoint}/${encode(config.bucket)}/${encodePath(key)}?${query}&X-Amz-Signature=${signature}`;
}

export function createBackblazeUploadUrl(config: BackblazeConfig, key: string, contentType: string): string {
  return signedUrl(config, "PUT", key, contentType);
}

export async function createBackblazeNativeUpload(config: BackblazeConfig, key: string, contentType: string) {
  const basic = Buffer.from(`${config.keyId}:${config.applicationKey}`).toString("base64");
  const authResponse = await fetch("https://api.backblazeb2.com/b2api/v2/b2_authorize_account", {
    headers: { Authorization: `Basic ${basic}` }, cache: "no-store",
  });
  if (!authResponse.ok) throw new Error("Backblaze não autorizou o upload nativo.");
  const auth = await authResponse.json() as { accountId: string; apiUrl: string; authorizationToken: string };
  const listResponse = await fetch(`${auth.apiUrl}/b2api/v2/b2_list_buckets`, {
    method: "POST", headers: { Authorization: auth.authorizationToken, "Content-Type": "application/json" },
    body: JSON.stringify({ accountId: auth.accountId, bucketName: config.bucket }), cache: "no-store",
  });
  if (!listResponse.ok) throw new Error("Backblaze não encontrou o bucket configurado.");
  const listed = await listResponse.json() as { buckets?: Array<{ bucketId?: string }> };
  const bucketId = listed.buckets?.[0]?.bucketId;
  if (!bucketId) throw new Error("Backblaze não encontrou o bucket configurado.");
  const uploadResponse = await fetch(`${auth.apiUrl}/b2api/v2/b2_get_upload_url`, {
    method: "POST", headers: { Authorization: auth.authorizationToken, "Content-Type": "application/json" },
    body: JSON.stringify({ bucketId }), cache: "no-store",
  });
  if (!uploadResponse.ok) throw new Error("Backblaze não devolveu um endpoint de upload.");
  const upload = await uploadResponse.json() as { uploadUrl: string; authorizationToken: string };
  return {
    uploadUrl: upload.uploadUrl,
    uploadHeaders: {
      Authorization: upload.authorizationToken,
      "X-Bz-File-Name": encodeURIComponent(key),
      "X-Bz-Content-Sha1": "do_not_verify",
      "Content-Type": contentType,
    },
  };
}

export function createBackblazeDownloadUrl(config: BackblazeConfig, key: string): string {
  return signedUrl(config, "GET", key, undefined, "900");
}

export async function headBackblazeObject(config: BackblazeConfig, key: string) {
  const response = await fetch(signedUrl(config, "HEAD", key), { method: "HEAD", cache: "no-store" });
  if (!response.ok) throw new Error("Backblaze não confirmou o ficheiro carregado.");
  const contentLength = Number(response.headers.get("content-length") ?? "");
  return {
    contentType: (response.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase(),
    contentLength: Number.isFinite(contentLength) && contentLength > 0 ? contentLength : null,
  };
}

export async function deleteBackblazeObject(config: BackblazeConfig, key: string): Promise<void> {
  const response = await fetch(signedUrl(config, "DELETE", key), { method: "DELETE", cache: "no-store" });
  if (!response.ok && response.status !== 404) throw new Error("Backblaze não permitiu remover o ficheiro.");
}

export function backblazePublicUrl(config: BackblazeConfig, key: string): string {
  const origin = (process.env["PUBLIC_SITE_URL"] ?? process.env["VITE_PUBLIC_SITE_URL"] ?? "").trim().replace(/\/+$/, "");
  return origin ? `${origin}/api/media/${encodePath(key)}` : `${config.endpoint}/${encode(config.bucket)}/${encodePath(key)}`;
}
