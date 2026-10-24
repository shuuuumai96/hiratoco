import {ICON_SIZE, MAX_ICON_LENGTH} from "./model.js";
import {AppError} from "./i18n.js";
import {imageDimensions, MAX_IMAGE_PIXELS} from "./image-header.js";

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

/**
 * Re-encode local raster images to bound stored data and discard metadata.
 * Release the decoded bitmap even when conversion fails.
 */
export async function readIconFile(file) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type) || file.size > MAX_FILE_BYTES) {
    throw new AppError("imageFileInvalid");
  }

  let expected;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length > MAX_FILE_BYTES) throw new AppError("imageFileInvalid");
    expected = imageDimensions(bytes, file.type);
  } catch (error) {
    throw error instanceof AppError ? error : new AppError("imageDecodeFailed");
  }

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new AppError("imageDecodeFailed");
  }
  try {
    if (bitmap.width * bitmap.height > MAX_IMAGE_PIXELS) {
      throw new AppError("imageTooLarge");
    }
    // EXIF orientation may rotate the decoded bitmap without changing its size.
    const same = bitmap.width === expected.width && bitmap.height === expected.height;
    const rotated = bitmap.width === expected.height && bitmap.height === expected.width;
    if (!same && !rotated) throw new AppError("imageDecodeFailed");

    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = ICON_SIZE;
    const scale = Math.min(ICON_SIZE / bitmap.width, ICON_SIZE / bitmap.height);
    const width = bitmap.width * scale;
    const height = bitmap.height * scale;
    canvas.getContext("2d").drawImage(bitmap, (ICON_SIZE - width) / 2, (ICON_SIZE - height) / 2, width, height);

    const icon = canvas.toDataURL("image/png");
    if (icon.length > MAX_ICON_LENGTH) {
      throw new AppError("imageConvertFailed");
    }
    return icon;
  } catch (error) {
    throw error instanceof AppError ? error : new AppError("imageConvertFailed");
  } finally {
    bitmap.close();
  }
}
