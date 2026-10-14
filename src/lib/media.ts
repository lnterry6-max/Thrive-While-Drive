import { supabase } from "./supabase";
import { MEDIA_BUCKET, PROFILE_FIELDS, type ProfileRecord } from "./profile";
export type ImageKind = "avatar" | "banner";
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export function validateImageFile(file: Pick<File, "size" | "type">) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error(
      "Choose a JPEG, PNG or WebP image. SVG and animated formats are not supported.",
    );
  if (file.size === 0 || file.size > MAX_IMAGE_BYTES)
    throw new Error("Choose an image smaller than 5 MB.");
}
export async function prepareImage(file: File, kind: ImageKind): Promise<Blob> {
  validateImageFile(file);
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const valid =
    file.type === "image/jpeg"
      ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : file.type === "image/png"
        ? [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)
        : String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
          String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (!valid)
    throw new Error(
      "This file does not match its image type. Please choose another photo.",
    );
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error(
      "This image could not be opened. Try another JPEG, PNG or WebP.",
    );
  });
  try {
    if (
      !bitmap.width ||
      !bitmap.height ||
      bitmap.width * bitmap.height > 40_000_000
    )
      throw new Error("Choose a photo under 40 megapixels.");
    const limit = kind === "avatar" ? 512 : 1600;
    const scale = Math.min(1, limit / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error(
        "Your browser cannot prepare images. Try a current browser.",
      );
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const encode = (type: "image/webp" | "image/jpeg") =>
      new Promise<Blob | null>((resolve) => {
        try {
          canvas.toBlob(resolve, type, 0.85);
        } catch {
          resolve(null);
        }
      });
    let blob = await encode("image/webp");
    if (blob?.type !== "image/webp") {
      // Safari may return PNG for unsupported WebP. JPEG needs an opaque
      // background, so flatten transparent pixels onto white.
      context.globalCompositeOperation = "destination-over";
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.globalCompositeOperation = "source-over";
      blob = await encode("image/jpeg");
      if (blob?.type !== "image/jpeg")
        throw new Error("This browser cannot prepare your photo. Try another current browser.");
    }
    if (blob.size > MAX_IMAGE_BYTES)
      throw new Error(
        "This image is too large after processing. Choose a smaller photo.",
      );
    return blob;
  } finally {
    bitmap.close();
  }
}
export async function uploadProfileImage(
  profile: ProfileRecord,
  kind: ImageKind,
  file: File,
) {
  if (!supabase) throw new Error("Sign in to upload a photo.");
  const blob = await prepareImage(file, kind);
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || auth.user?.id !== profile.id)
    throw new Error("Your session changed. Sign in again before uploading.");
  const extension = blob.type === "image/webp" ? "webp" : blob.type === "image/jpeg" ? "jpg" : null;
  if (!extension) throw new Error("The prepared image has an unsupported format.");
  const path = `${profile.id}/${kind}/${crypto.randomUUID()}.${extension}`;
  const bucket = supabase.storage.from(MEDIA_BUCKET);
  const { error } = await bucket.upload(path, blob, {
    contentType: blob.type,
    upsert: false,
    cacheControl: "60",
  });
  if (error) throw error;
  const field = kind === "avatar" ? "avatar_path" : "banner_path";
  const { data, error: saveError } = await supabase
    .from("profiles")
    .update(kind === "avatar" ? { avatar_path: path } : { banner_path: path })
    .eq("id", profile.id)
    .select(PROFILE_FIELDS)
    .single();
  if (saveError || !data) {
    await bucket.remove([path]);
    throw saveError ?? new Error("Your photo was not saved. Please try again.");
  }
  const oldPath = profile[field];
  const cleanup = oldPath ? await bucket.remove([oldPath]) : null;
  return {
    profile: data as ProfileRecord,
    warning: cleanup?.error
      ? "Photo saved. The previous image could not be removed; try removing it from account settings later."
      : "",
  };
}
export async function deleteAccountImages(userId: string) {
  if (!supabase) throw new Error("Sign in again.");
  const bucket = supabase.storage.from(MEDIA_BUCKET);
  for (const kind of ["avatar", "banner"]) {
    const removed = new Set<string>();
    for (;;) {
      const { data, error } = await bucket.list(`${userId}/${kind}`, {
        limit: 100,
      });
      if (error) throw error;
      if (!data?.length) break;
      if (data.some((file) => removed.has(file.name)))
        throw new Error("Photo cleanup did not finish. Please try again.");
      const { error: removeError } = await bucket.remove(
        data.map((file) => `${userId}/${kind}/${file.name}`),
      );
      if (removeError) throw removeError;
      data.forEach((file) => removed.add(file.name));
    }
  }
}
