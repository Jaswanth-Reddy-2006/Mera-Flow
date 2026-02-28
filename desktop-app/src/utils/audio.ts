/**
 * Utility function to convert an AudioBuffer to a 16-bit PCM WAV blob.
 * Optimized for 16kHz sample rate as required by Whisper.
 */
export async function bufferToWav(buffer: AudioBuffer): Promise<Blob> {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    const length = buffer.length * numChannels * (bitDepth / 8);
    const arrayBuffer = new ArrayBuffer(44 + length);
    const view = new DataView(arrayBuffer);

    // RIFF identifier
    writeString(view, 0, 'RIFF');
    // RIFF chunk length
    view.setUint32(4, 36 + length, true);
    // RIFF type
    writeString(view, 8, 'WAVE');
    // format chunk identifier
    writeString(view, 12, 'fmt ');
    // format chunk length
    view.setUint32(16, 16, true);
    // sample format (1 is PCM)
    view.setUint16(20, format, true);
    // channel count
    view.setUint16(22, numChannels, true);
    // sample rate
    view.setUint32(24, sampleRate, true);
    // byte rate (sample rate * block align)
    view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
    // block align (channel count * bytes per sample)
    view.setUint16(32, numChannels * (bitDepth / 8), true);
    // bits per sample
    view.setUint16(34, bitDepth, true);
    // data chunk identifier
    writeString(view, 36, 'data');
    // data chunk length
    view.setUint32(40, length, true);

    // Write PCM data
    const offset = 44;
    const channelData = [];
    for (let i = 0; i < numChannels; i++) {
        channelData.push(buffer.getChannelData(i));
    }

    let pos = 0;
    for (let i = 0; i < buffer.length; i++) {
        for (let channel = 0; channel < numChannels; channel++) {
            const sample = Math.max(-1, Math.min(1, channelData[channel][i]));
            view.setInt16(offset + pos, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
            pos += 2;
        }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

/**
 * Audio Recording Helper Class
 */
export class AudioRecorder {
    private mediaRecorder: MediaRecorder | null = null;
    private audioChunks: Blob[] = [];
    private audioContext: AudioContext | null = null;
    private analyser: AnalyserNode | null = null;
    private dataArray: Uint8Array | null = null;
    private source: MediaStreamAudioSourceNode | null = null;
    private animationId: number | null = null;

    async start(onVolumeChange?: (vol: number) => void) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.mediaRecorder = new MediaRecorder(stream);
        this.audioChunks = [];

        // Setup real-time audio analysis
        this.audioContext = new AudioContext();
        this.source = this.audioContext.createMediaStreamSource(stream);
        this.analyser = this.audioContext.createAnalyser();

        // Fast fourier transform size - 256 is an excellent sweet spot for voice
        this.analyser.fftSize = 256;

        const bufferLength = this.analyser.frequencyBinCount;
        this.dataArray = new Uint8Array(bufferLength);
        this.source.connect(this.analyser);

        const analyze = () => {
            if (this.analyser && this.dataArray && onVolumeChange) {
                this.analyser.getByteFrequencyData(this.dataArray as unknown as Uint8Array<ArrayBuffer>);

                // Calculate average frequency volume (the "bass"/loudness)
                let sum = 0;
                for (let i = 0; i < bufferLength; i++) {
                    sum += this.dataArray[i];
                }
                const average = sum / bufferLength;

                // Normalize map [0-255] roughly to [0-1] for easy CSS heights
                const normalized = Math.min(1, Math.max(0, average / 128));
                onVolumeChange(normalized);
            }
            this.animationId = requestAnimationFrame(analyze);
        };

        if (onVolumeChange) {
            analyze();
        }

        this.mediaRecorder.ondataavailable = (event) => {
            this.audioChunks.push(event.data);
        };

        this.mediaRecorder.start();
    }

    async stop(): Promise<Blob> {
        return new Promise((resolve) => {
            if (this.animationId !== null) cancelAnimationFrame(this.animationId);

            if (!this.mediaRecorder) return resolve(new Blob());

            this.mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });

                const arrayBuffer = await audioBlob.arrayBuffer();

                // Normal AudioContext needed just to decode the blob reliably
                const tempCtx = new AudioContext({ sampleRate: 16000 });
                const audioBufferResource = await tempCtx.decodeAudioData(arrayBuffer);

                const wavBlob = await bufferToWav(audioBufferResource);

                // Stop all tracks to release the microphone entirely
                this.mediaRecorder?.stream.getTracks().forEach(track => track.stop());

                if (this.audioContext?.state !== 'closed') {
                    this.audioContext?.close().catch(() => { });
                }
                if (tempCtx.state !== 'closed') {
                    tempCtx.close().catch(() => { });
                }

                resolve(wavBlob);
            };

            this.mediaRecorder.stop();
        });
    }
}
