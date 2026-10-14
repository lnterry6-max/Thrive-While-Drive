import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { mock, profileFixture, resetSupabase } from "../test/supabaseMock";
import {
  deleteAccountImages,
  MAX_IMAGE_BYTES,
  prepareImage,
  uploadProfileImage,
  validateImageFile,
} from "./media";
import type { ProfileRecord } from "./profile";
beforeEach(resetSupabase);
afterEach(() => vi.unstubAllGlobals());
it.each(["image/svg+xml", "image/gif", "text/html", "application/javascript"])(
  "rejects unsafe or unsupported %s files",
  (type) => {
    expect(() => validateImageFile({ type, size: 100 })).toThrow(
      /JPEG, PNG or WebP/,
    );
  },
);
it.each([0, MAX_IMAGE_BYTES + 1])(
  "rejects empty or oversized files (%s)",
  (size) => {
    expect(() => validateImageFile({ type: "image/jpeg", size })).toThrow(
      /5 MB/,
    );
  },
);
it("accepts supported image types within the limit", () => {
  for (const type of ["image/jpeg", "image/png", "image/webp"])
    expect(() => validateImageFile({ type, size: 1000 })).not.toThrow();
});
it("rejects spoofed image signatures before decoding", async () => {
  const file = {
    type: "image/png",
    size: 20,
    slice: () => ({
      arrayBuffer: async () => new Uint8Array([60, 115, 118, 103]).buffer,
    }),
  } as unknown as File;
  await expect(prepareImage(file, "avatar")).rejects.toThrow(/does not match/);
});
function imageMocks() {
  const close = vi.fn();
  const drawImage = vi.fn();
  const fillRect = vi.fn();
  const context = { drawImage, fillRect, fillStyle: "", globalCompositeOperation: "source-over" };
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn().mockResolvedValue({ width: 2400, height: 1600, close }),
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
    (callback) =>
      callback(new Blob(["converted pixels"], { type: "image/webp" })),
  );
  const file = {
    type: "image/jpeg",
    size: 500,
    slice: () => ({
      arrayBuffer: async () => new Uint8Array([255, 216, 255]).buffer,
    }),
  } as unknown as File;
  return { close, drawImage, fillRect, context, file };
}
it("resizes and re-encodes uploads as WebP, closing the decoded bitmap", async () => {
  const { file, close, drawImage } = imageMocks();
  const blob = await prepareImage(file, "avatar");
  expect(blob.type).toBe("image/webp");
  expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 512, 341);
  expect(close).toHaveBeenCalledOnce();
});
it("falls back to JPEG when Safari returns PNG for WebP export", async () => {
  const { file, fillRect, context } = imageMocks();
  const formats: string[] = [];
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback, type) => {
    formats.push(type ?? "");
    callback(
      new Blob(["encoded"], {
        type: type === "image/webp" ? "image/png" : "image/jpeg",
      }),
    );
  });
  const blob = await prepareImage(file, "banner");
  expect(blob.type).toBe("image/jpeg");
  expect(formats).toEqual(["image/webp", "image/jpeg"]);
  expect(fillRect).toHaveBeenCalledWith(0, 0, 1600, 1067);
  expect(context.globalCompositeOperation).toBe("source-over");
});
it("falls back to JPEG when WebP encoding returns null", async () => {
  const { file } = imageMocks();
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback, type) => {
    callback(type === "image/webp" ? null : new Blob(["jpeg"], { type: "image/jpeg" }));
  });
  expect((await prepareImage(file, "avatar")).type).toBe("image/jpeg");
});
it("reports an error if neither WebP nor JPEG can be encoded", async () => {
  const { file } = imageMocks();
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) =>
    callback(new Blob(["not an accepted output"], { type: "image/png" })),
  );
  await expect(prepareImage(file, "avatar")).rejects.toThrow(/cannot prepare your photo/);
});
it("uploads a JPEG fallback with the matching extension and MIME type", async () => {
  const { file } = imageMocks();
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback, type) =>
    callback(type === "image/webp" ? null : new Blob(["jpeg"], { type: "image/jpeg" })),
  );
  await uploadProfileImage(profileFixture as ProfileRecord, "avatar", file);
  expect(mock.upload).toHaveBeenCalledWith(
    expect.stringMatching(/^user-a\/avatar\/[a-f0-9-]+\.jpg$/),
    expect.objectContaining({ type: "image/jpeg" }),
    { contentType: "image/jpeg", upsert: false, cacheControl: "60" },
  );
});
it("rejects excessive decoded dimensions", async () => {
  const { file } = imageMocks();
  vi.mocked(createImageBitmap).mockResolvedValue({
    width: 10000,
    height: 10000,
    close: vi.fn(),
  } as unknown as ImageBitmap);
  await expect(prepareImage(file, "banner")).rejects.toThrow(/40 megapixels/);
});
it("uploads to the current user folder without overwrite", async () => {
  const { file } = imageMocks();
  const result = await uploadProfileImage(
    profileFixture as ProfileRecord,
    "avatar",
    file,
  );
  expect(mock.upload).toHaveBeenCalledWith(
    expect.stringMatching(/^user-a\/avatar\/[a-f0-9-]+\.webp$/),
    expect.any(Blob),
    { contentType: "image/webp", upsert: false, cacheControl: "60" },
  );
  expect(mock.eq).toHaveBeenCalledWith("id", "user-a");
  expect(result.profile).toEqual(profileFixture);
});
it("does not upload after the session changes", async () => {
  const { file } = imageMocks();
  mock.getUser.mockResolvedValue({ data: { user: { id: "someone-else" } } });
  await expect(
    uploadProfileImage(profileFixture as ProfileRecord, "avatar", file),
  ).rejects.toThrow(/session changed/);
  expect(mock.upload).not.toHaveBeenCalled();
});
it("cleans up a newly uploaded file when the profile write fails", async () => {
  const { file } = imageMocks();
  mock.write.mockResolvedValue({ data: null, error: { message: "Denied" } });
  await expect(
    uploadProfileImage(profileFixture as ProfileRecord, "avatar", file),
  ).rejects.toEqual({ message: "Denied" });
  expect(mock.remove).toHaveBeenCalledWith([
    expect.stringContaining("user-a/avatar/"),
  ]);
});
it("does not erase the old photo before the replacement is saved", async () => {
  const { file } = imageMocks();
  mock.write.mockResolvedValue({ data: null, error: { message: "Denied" } });
  await expect(
    uploadProfileImage(
      {
        ...profileFixture,
        avatar_path: "user-a/avatar/old.webp",
      } as ProfileRecord,
      "avatar",
      file,
    ),
  ).rejects.toBeTruthy();
  expect(mock.remove).not.toHaveBeenCalledWith(["user-a/avatar/old.webp"]);
});
it("deletes stored photos in batches using only the owner prefixes", async () => {
  mock.list
    .mockResolvedValueOnce({ data: [{ name: "aaa.webp" }] })
    .mockResolvedValue({ data: [] });
  await deleteAccountImages("user-a");
  expect(mock.remove).toHaveBeenCalledWith(["user-a/avatar/aaa.webp"]);
  expect(mock.list).toHaveBeenCalledWith("user-a/banner", { limit: 100 });
});
it("stops account-image cleanup on a storage error", async () => {
  mock.list.mockResolvedValue({
    data: null,
    error: { message: "Storage unavailable" },
  });
  await expect(deleteAccountImages("user-a")).rejects.toEqual({
    message: "Storage unavailable",
  });
  expect(mock.remove).not.toHaveBeenCalled();
});
it("stops cleanup if storage reports success without removing files", async () => {
  mock.list.mockResolvedValue({ data: [{ name: "aaa.webp" }] });
  await expect(deleteAccountImages("user-a")).rejects.toThrow(/did not finish/);
  expect(mock.remove).toHaveBeenCalledTimes(1);
});
