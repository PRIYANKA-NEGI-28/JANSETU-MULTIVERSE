import { Audio } from 'expo-av';
import { transcribeAudio, type TranscriptionResultDto } from './api-client';

export interface RecorderState {
  readonly isRecording: boolean;
  readonly durationSeconds: number;
  readonly isTranscribing: boolean;
  readonly uri: string | null;
  readonly error: string | null;
}

export interface AudioRecordingService {
  startRecording: () => Promise<boolean>;
  stopRecording: (langHint?: string) => Promise<TranscriptionResultDto | null>;
  cancelRecording: () => Promise<void>;
  getDuration: () => number;
}

export const MAX_RECORDING_DURATION_SEC = 60;

export async function requestAudioPermissions(): Promise<boolean> {
  try {
    const { status } = await Audio.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

export class MobileAudioRecorder {
  private recording: Audio.Recording | null = null;
  private durationInterval: ReturnType<typeof setInterval> | null = null;
  private seconds = 0;
  private onDurationUpdate?: (seconds: number) => void;
  private onMaxReached?: () => void;

  constructor(callbacks?: {
    onDurationUpdate?: (seconds: number) => void;
    onMaxReached?: () => void;
  }) {
    this.onDurationUpdate = callbacks?.onDurationUpdate;
    this.onMaxReached = callbacks?.onMaxReached;
  }

  async start(): Promise<boolean> {
    try {
      const hasPermission = await requestAudioPermissions();
      if (!hasPermission) {
        throw new Error('Microphone permission was not granted');
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      if (this.recording) {
        await this.cancel();
      }

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      this.recording = recording;
      this.seconds = 0;

      this.durationInterval = setInterval(() => {
        this.seconds += 1;
        this.onDurationUpdate?.(this.seconds);
        if (this.seconds >= MAX_RECORDING_DURATION_SEC) {
          this.onMaxReached?.();
        }
      }, 1000);

      return true;
    } catch {
      await this.cancel();
      return false;
    }
  }

  async stop(langHint?: string): Promise<TranscriptionResultDto | null> {
    if (!this.recording) return null;

    try {
      if (this.durationInterval) {
        clearInterval(this.durationInterval);
        this.durationInterval = null;
      }

      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      this.recording = null;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      if (!uri) return null;

      return await transcribeAudio(uri, langHint);
    } catch {
      this.recording = null;
      return null;
    }
  }

  async cancel(): Promise<void> {
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }
    if (this.recording) {
      try {
        await this.recording.stopAndUnloadAsync();
      } catch {
        // Ignore unload error
      }
      this.recording = null;
    }
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
  }

  getDuration(): number {
    return this.seconds;
  }
}
