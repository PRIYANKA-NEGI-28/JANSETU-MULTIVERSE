import { useState, useRef, useCallback } from 'react';
import { api } from '../lib/api.js';

export interface VoiceRecorderState {
  readonly isRecording: boolean;
  readonly recordingTimeSec: number;
  readonly isTranscribing: boolean;
  readonly error: string | null;
  readonly transcript: string | null;
  readonly detectedLang: string | null;
  readonly translatedEn: string | null;
  readonly translatedHi: string | null;
}

export interface UseVoiceRecorderReturn extends VoiceRecorderState {
  readonly startRecording: () => Promise<void>;
  readonly stopRecording: () => Promise<{ transcript: string; lang: string } | null>;
  readonly cancelRecording: () => void;
  readonly clearTranscript: () => void;
}

export function useVoiceRecorder(preferredLang = 'hi'): UseVoiceRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTimeSec, setRecordingTimeSec] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [detectedLang, setDetectedLang] = useState<string | null>(null);
  const [translatedEn, setTranslatedEn] = useState<string | null>(null);
  const [translatedHi, setTranslatedHi] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);

  const startRecording = useCallback(async () => {
    setError(null);
    audioChunksRef.current = [];
    setRecordingTimeSec(0);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Browser does not support microphone access.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Prefer audio/webm if supported, with fallbacks
      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg';
        } else {
          mimeType = '';
        }
      }

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.start(250); // Emit slice every 250ms
      setIsRecording(true);

      timerIntervalRef.current = window.setInterval(() => {
        setRecordingTimeSec((prev) => {
          if (prev >= 60) {
            // Maximum 60 seconds per voice complaint
            void stopRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Microphone permission denied';
      setError(msg);
      setIsRecording(false);
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<{ transcript: string; lang: string } | null> => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      setIsRecording(false);
      return null;
    }

    return new Promise((resolve) => {
      recorder.onstop = async () => {
        setIsRecording(false);
        // Stop audio tracks to release microphone
        recorder.stream.getTracks().forEach((track) => track.stop());

        const mime = recorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mime });

        if (audioBlob.size < 100) {
          setError('Recorded audio was too short. Please try speaking again.');
          resolve(null);
          return;
        }

        setIsTranscribing(true);
        setError(null);

        try {
          const extension = mime.includes('mp4') ? 'mp4' : mime.includes('ogg') ? 'ogg' : 'webm';
          const audioFile = new File([audioBlob], `complaint_voice.${extension}`, { type: mime });

          const formData = new FormData();
          formData.append('file', audioFile);
          formData.append('language', preferredLang);

          const result = await api.ai.transcribe(formData);

          setTranscript(result.transcript);
          setDetectedLang(result.detectedLang);
          setTranslatedEn(result.translatedEn);
          setTranslatedHi(result.translatedHi);

          resolve({
            transcript: result.transcript,
            lang: result.detectedLang,
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Transcription failed. Please type manually.';
          setError(msg);
          resolve(null);
        } finally {
          setIsTranscribing(false);
        }
      };

      recorder.stop();
    });
  }, [preferredLang]);

  const cancelRecording = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stream.getTracks().forEach((track) => track.stop());
      recorder.stop();
    }
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingTimeSec(0);
  }, []);

  const clearTranscript = useCallback(() => {
    setTranscript(null);
    setDetectedLang(null);
    setTranslatedEn(null);
    setTranslatedHi(null);
  }, []);

  return {
    isRecording,
    recordingTimeSec,
    isTranscribing,
    error,
    transcript,
    detectedLang,
    translatedEn,
    translatedHi,
    startRecording,
    stopRecording,
    cancelRecording,
    clearTranscript,
  };
}
