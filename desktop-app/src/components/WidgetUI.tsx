import { useState, useEffect, useCallback, useRef } from 'react';
import { listen, emit } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { X, Square, Loader2 } from 'lucide-react';
import { AudioRecorder } from '../utils/audio';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const isTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export default function WidgetUI() {
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [volume, setVolume] = useState(0);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const recorderRef = useRef<AudioRecorder | null>(null);

    useEffect(() => {
        recorderRef.current = new AudioRecorder();
    }, []);

    const handleTranscription = useCallback(async (blob: Blob) => {
        const formData = new FormData();
        formData.append('file', blob, 'audio.wav');
        setIsProcessing(true);
        try {
            const response = await fetch(`${API_URL}/transcribe`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) throw new Error(`Status ${response.status}`);
            const data = await response.json();
            const newText = data.transcript;

            if (newText) {
                if (isTauri()) {
                    await emit('new-transcription', { text: newText });
                    await writeText(newText);
                    setTimeout(async () => {
                        await invoke('paste_transcript');
                    }, 150);
                }
            }
        } catch (err: any) {
            console.warn("Transcription err:", err);
            setErrorMsg("Err");
            setTimeout(() => setErrorMsg(null), 2000);
        } finally {
            setIsProcessing(false);
        }
    }, []);

    const startRecording = useCallback(async () => {
        if (isRecording || isProcessing) return;
        try {
            await recorderRef.current?.start((vol: number) => {
                setVolume(vol);
            });
            setIsRecording(true);
        } catch (err: any) {
            console.warn("Start Err:", err);
            setErrorMsg("Mic Err");
            setTimeout(() => setErrorMsg(null), 2000);
        }
    }, [isRecording, isProcessing]);

    const stopRecording = useCallback(async () => {
        if (!isRecording) return;
        setIsRecording(false);
        try {
            const audioBlob = await recorderRef.current?.stop();
            if (audioBlob) {
                await handleTranscription(audioBlob);
            }
        } catch (err: any) {
            if (err.name !== "InvalidStateError" && !err.message?.includes("inactive")) {
                setErrorMsg("Err");
                setTimeout(() => setErrorMsg(null), 2000);
            }
        }
    }, [isRecording, handleTranscription]);

    const cancelRecording = useCallback(async () => {
        if (!isRecording) return;
        setIsRecording(false);
        try {
            await recorderRef.current?.stop();
        } catch (e) { }
    }, [isRecording]);

    useEffect(() => {
        if (!isTauri()) return;
        let unlistenPressed: (() => void) | null = null;
        let unlistenReleased: (() => void) | null = null;
        listen('shortcut-pressed', () => startRecording()).then(u => unlistenPressed = u).catch(console.warn);
        listen('shortcut-released', () => stopRecording()).then(u => unlistenReleased = u).catch(console.warn);
        return () => {
            if (unlistenPressed) unlistenPressed();
            if (unlistenReleased) unlistenReleased();
        };
    }, [startRecording, stopRecording]);

    return (
        <div className="w-full h-full min-h-screen flex items-center justify-center bg-transparent select-none overflow-hidden font-sans p-2">
            <div
                data-tauri-drag-region
                className="relative flex items-center justify-center bg-black border border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.9)] rounded-full transition-colors w-[110px] h-[40px] px-2.5 cursor-move overflow-hidden"
            >
                {errorMsg ? (
                    <span className="text-rose-400 text-[11px] font-bold tracking-widest pointer-events-none">{errorMsg}</span>
                ) : isProcessing ? (
                    <Loader2 className="w-5 h-5 text-emerald-400 animate-spin pointer-events-none" />
                ) : isRecording ? (
                    <div className="flex w-full h-full items-center justify-between gap-[3px] pointer-events-none">

                        <button
                            onClick={cancelRecording}
                            data-tauri-drag-region="false"
                            className="shrink-0 w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors pointer-events-auto cursor-pointer"
                        >
                            <X className="w-3 h-3 text-white/70 hover:text-white" />
                        </button>

                        <div className="flex-1 flex items-center justify-center gap-[3px] opacity-90 pointer-events-none min-h-[24px]">
                            <div className="w-[3px] rounded-full bg-white transition-[height] duration-75 ease-out" style={{ height: Math.max(4, volume * 20 + 4) + 'px' }} />
                            <div className="w-[3px] rounded-full bg-white transition-[height] duration-75 ease-out" style={{ height: Math.max(4, volume * 28 + 4) + 'px' }} />
                            <div className="w-[3px] rounded-full bg-white transition-[height] duration-75 ease-out" style={{ height: Math.max(4, volume * 36 + 4) + 'px' }} />
                            <div className="w-[3px] rounded-full bg-white transition-[height] duration-75 ease-out" style={{ height: Math.max(4, volume * 28 + 4) + 'px' }} />
                            <div className="w-[3px] rounded-full bg-white transition-[height] duration-75 ease-out" style={{ height: Math.max(4, volume * 20 + 4) + 'px' }} />
                        </div>

                        <button
                            onClick={stopRecording}
                            data-tauri-drag-region="false"
                            className="shrink-0 w-6 h-6 rounded-full bg-rose-500 hover:bg-rose-400 flex items-center justify-center transition-all shadow-[0_0_12px_rgba(244,63,94,0.4)] pointer-events-auto cursor-pointer whitespace-nowrap"
                        >
                            <Square className="w-2.5 h-2.5 fill-white text-white" />
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={startRecording}
                        data-tauri-drag-region="false"
                        className="w-full h-full rounded-full flex items-center justify-center hover:bg-white/5 transition-colors group cursor-pointer"
                    >
                        <div className="w-2.5 h-2.5 rounded-full bg-white/30 group-hover:bg-white/60 transition-colors pointer-events-none shadow-[0_0_8px_rgba(255,255,255,0.2)]" />
                    </button>
                )}
            </div>
        </div>
    );
}
