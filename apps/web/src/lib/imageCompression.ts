import imageCompression from 'browser-image-compression';

export interface ImageCompressionOptions {
  readonly maxSizeMB?: number;
  readonly maxWidthOrHeight?: number;
  readonly fileType?: string;
  readonly initialQuality?: number;
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

  const compressionConfig: imageCompression.Options = {
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
    // If worker or compression fails in older browser, fallback gracefully to original file
    return file;
  }
}
