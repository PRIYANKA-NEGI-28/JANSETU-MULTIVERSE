import imageCompression, { type Options as CompressionOptions } from 'browser-image-compression';

export interface ImageCompressionOptions {
  readonly maxSizeMB?: number;
  readonly maxWidthOrHeight?: number;
  readonly fileType?: string;
  readonly initialQuality?: number;
}

async function stripExifViaCanvas(
  file: File,
  maxWidthOrHeight: number,
  fileType: string,
  quality: number
): Promise<File> {
  if (typeof document === 'undefined') {
    return file;
  }
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
      if (width > maxWidthOrHeight || height > maxWidthOrHeight) {
        if (width > height) {
          height = Math.round((height * maxWidthOrHeight) / width);
          width = maxWidthOrHeight;
        } else {
          width = Math.round((width * maxWidthOrHeight) / height);
          height = maxWidthOrHeight;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const originalName = file.name.replace(/\.[^/.]+$/, '');
          const extension = fileType === 'image/webp' ? 'webp' : 'jpg';
          resolve(
            new File([blob], `${originalName}.${extension}`, {
              type: fileType,
              lastModified: Date.now(),
            })
          );
        },
        fileType,
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };
    img.src = objectUrl;
  });
}

export async function compressCivicImage(
  file: File,
  options: ImageCompressionOptions = {}
): Promise<File> {
  const {
    maxSizeMB = 1.0,
    maxWidthOrHeight = 1280,
    fileType = 'image/webp',
    initialQuality = 0.85,
  } = options;

  // If the file is not an image, return untouched
  if (!file.type.startsWith('image/')) {
    return file;
  }

  const compressionConfig: CompressionOptions = {
    maxSizeMB,
    maxWidthOrHeight,
    useWebWorker: true,
    fileType,
    initialQuality,
    alwaysKeepResolution: false,
    // Setting preserveExif to false explicitly strips metadata / GPS / camera tags for citizen privacy
    preserveExif: false,
  };

  try {
    const compressedBlob = await imageCompression(file, compressionConfig);
    // Retain clean filename with .webp extension if converted
    const originalName = file.name.replace(/\.[^/.]+$/, '');
    const extension = fileType === 'image/webp' ? 'webp' : 'jpg';
    const newFileName = `${originalName}.${extension}`;

    return new File([compressedBlob], newFileName, {
      type: fileType,
      lastModified: Date.now(),
    });
  } catch {
    // If worker or compression fails in older browser, fallback gracefully to canvas EXIF-stripped blob
    try {
      return await stripExifViaCanvas(file, maxWidthOrHeight, fileType, initialQuality);
    } catch {
      return file;
    }
  }
}
