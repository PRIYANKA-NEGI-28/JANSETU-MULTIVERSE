import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { uploadImageToR2 } from './api-client';

export interface ProcessedImage {
  readonly uri: string;
  readonly width: number;
  readonly height: number;
  readonly r2Key?: string;
  readonly publicUrl?: string;
}

export const MAX_IMAGE_DIMENSION = 1280;
export const TARGET_IMAGE_QUALITY = 0.7;

export async function requestCameraPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  return status === 'granted';
}

export async function requestMediaLibraryPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return status === 'granted';
}

export async function compressAndResizeImage(sourceUri: string): Promise<ImageManipulator.ImageResult> {
  return await ImageManipulator.manipulateAsync(
    sourceUri,
    [{ resize: { width: MAX_IMAGE_DIMENSION } }],
    {
      compress: TARGET_IMAGE_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
    }
  );
}

export async function capturePhotoWithCamera(): Promise<ProcessedImage | null> {
  const hasPermission = await requestCameraPermission();
  if (!hasPermission) {
    throw new Error('Camera access permission was denied. Please allow camera access in device settings.');
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.8,
  });

  if (result.canceled || !result.assets[0]?.uri) {
    return null;
  }

  const compressed = await compressAndResizeImage(result.assets[0].uri);
  const uploaded = await uploadImageToR2(compressed.uri);

  return {
    uri: compressed.uri,
    width: compressed.width,
    height: compressed.height,
    r2Key: uploaded.key,
    publicUrl: uploaded.publicUrl,
  };
}

export async function pickPhotoFromLibrary(): Promise<ProcessedImage | null> {
  const hasPermission = await requestMediaLibraryPermission();
  if (!hasPermission) {
    throw new Error('Photo library permission was denied. Please allow photo access in device settings.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.8,
  });

  if (result.canceled || !result.assets[0]?.uri) {
    return null;
  }

  const compressed = await compressAndResizeImage(result.assets[0].uri);
  const uploaded = await uploadImageToR2(compressed.uri);

  return {
    uri: compressed.uri,
    width: compressed.width,
    height: compressed.height,
    r2Key: uploaded.key,
    publicUrl: uploaded.publicUrl,
  };
}
