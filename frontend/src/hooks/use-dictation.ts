"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";

// Voice to text. Chrome/Safari: native SpeechRecognition with live interim text.
// Elsewhere (Firefox): record with MediaRecorder and let the backend transcribe.
export type DictationState = "idle" | "listening" | "recording" | "transcribing";

interface RecognitionResult { isFinal: boolean; 0: { transcript: string } }
interface RecognitionEvent { resultIndex: number; results: ArrayLike<RecognitionResult> }
interface Recognition {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
}
type RecognitionCtor = new () => Recognition;

const SILENCE_MS = 3000;
const FIRST_WORD_MS = 6000;
const MAX_SECONDS = 60;
const MAX_BYTES = 5 * 1024 * 1024;
export const NO_MIC = "No tengo acceso al micrófono. Revisa el permiso del navegador.";

function recognitionCtor(): RecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

interface Options {
  onFinal: (text: string) => void; // native: text the browser is sure about
  onTranscript: (text: string) => void; // fallback: the whole transcription at once
}

export function useDictation({ onFinal, onTranscript }: Options) {
  const [state, setState] = useState<DictationState>("idle");
  const [interim, setInterim] = useState("");
  const [level, setLevel] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handlers = useRef({ onFinal, onTranscript });
  useEffect(() => {
    handlers.current = { onFinal, onTranscript };
  }, [onFinal, onTranscript]);

  const recognition = useRef<Recognition | null>(null);
  const silence = useRef<ReturnType<typeof setTimeout>>(undefined);
  const interimRef = useRef("");
  const recorder = useRef<MediaRecorder | null>(null);
  const discard = useRef(false);
  const teardown = useRef<(() => void) | null>(null);

  const setInterimText = (t: string) => {
    interimRef.current = t;
    setInterim(t);
  };

  const startNative = useCallback((Ctor: RecognitionCtor) => {
    const rec = new Ctor();
    rec.lang = "es-CO";
    rec.interimResults = true;
    rec.continuous = true;
    const armSilence = (ms: number) => {
      clearTimeout(silence.current);
      silence.current = setTimeout(() => rec.stop(), ms);
    };
    rec.onresult = (e) => {
      let fin = "";
      let tmp = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) fin += r[0].transcript;
        else tmp += r[0].transcript;
      }
      if (fin) handlers.current.onFinal(fin);
      setInterimText(tmp);
      armSilence(SILENCE_MS);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed" || e.error === "audio-capture") setError(NO_MIC);
      else if (e.error === "network") setError("No pude conectar con el reconocimiento de voz.");
    };
    rec.onend = () => {
      clearTimeout(silence.current);
      if (interimRef.current && !discard.current) handlers.current.onFinal(interimRef.current);
      setInterimText("");
      recognition.current = null;
      setState("idle");
    };
    recognition.current = rec;
    try {
      rec.start();
      setState("listening");
      armSilence(FIRST_WORD_MS);
    } catch {
      recognition.current = null;
      setError(NO_MIC);
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError(NO_MIC);
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError(NO_MIC);
      return;
    }
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/ogg"].find((m) => MediaRecorder.isTypeSupported(m));
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];

    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Uint8Array(analyser.fftSize);
    const meter = setInterval(() => {
      analyser.getByteTimeDomainData(buf);
      let peak = 0;
      for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
      setLevel(Math.min(1, peak / 64));
    }, 80);
    const began = Date.now();
    const clock = setInterval(() => {
      const s = Math.floor((Date.now() - began) / 1000);
      setSeconds(s);
      if (s >= MAX_SECONDS) rec.stop();
    }, 250);

    const release = () => {
      clearInterval(meter);
      clearInterval(clock);
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close();
      setLevel(0);
      teardown.current = null;
    };
    teardown.current = () => {
      discard.current = true;
      if (rec.state !== "inactive") rec.stop();
    };

    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    rec.onstop = async () => {
      release();
      recorder.current = null;
      if (discard.current) {
        setState("idle");
        return;
      }
      const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
      if (blob.size > MAX_BYTES) {
        setError("La grabación es demasiado larga.");
        setState("idle");
        return;
      }
      setState("transcribing");
      try {
        const { text } = await api.transcribe(blob);
        if (!discard.current) {
          if (text.trim()) handlers.current.onTranscript(text.trim());
          else setError("No escuché nada. Inténtalo de nuevo.");
        }
      } catch (e) {
        setError(e instanceof ApiError && e.status === 413 ? "La grabación es demasiado larga." : "No pude transcribir el audio.");
      }
      setState("idle");
    };
    recorder.current = rec;
    setSeconds(0);
    rec.start();
    setState("recording");
  }, []);

  const start = useCallback(() => {
    setError(null);
    discard.current = false;
    const Ctor = recognitionCtor();
    if (Ctor) startNative(Ctor);
    else void startRecording();
  }, [startNative, startRecording]);

  const stop = useCallback(() => {
    if (recognition.current) recognition.current.stop();
    else if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
  }, []);

  // Throw away whatever is in flight (message sent, or the screen goes away).
  const cancel = useCallback(() => {
    discard.current = true;
    clearTimeout(silence.current);
    if (recognition.current) recognition.current.abort();
    teardown.current?.();
  }, []);

  useEffect(() => cancel, [cancel]);

  return { state, interim, level, seconds, error, start, stop, cancel, dismissError: () => setError(null) };
}
