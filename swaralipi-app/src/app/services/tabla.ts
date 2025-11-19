import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface TablaRecordingData {
  bols: string[];
  timings: number[];
  duration: number;
}

@Injectable({
  providedIn: 'root'
})
export class TablaService {
  private audioContext: AudioContext | null = null;
  private isRecording = false;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];

  private recordingCompleteSubject = new Subject<TablaRecordingData>();
  public recordingComplete$ = this.recordingCompleteSubject.asObservable();

  constructor() {}

  private initializeAudioContext(): void {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  /**
   * Play a tabla bol
   * @param bol The bol to play (धा, ति, etc.)
   * @param duration Duration in seconds
   */
  playBol(bol: string, duration: number = 0.3): void {
    this.initializeAudioContext();
    if (!this.audioContext) return;

    const now = this.audioContext.currentTime;

    // Different bols have different sound characteristics
    switch (bol) {
      case 'धा':
      case 'धिं':
        this.playDha(now, duration);
        break;
      case 'ति':
      case 'तिं':
        this.playTi(now, duration);
        break;
      case 'ता':
        this.playTa(now, duration);
        break;
      case 'गे':
      case 'का':
        this.playGe(now, duration);
        break;
      case 'ना':
        this.playNa(now, duration);
        break;
      default:
        this.playGeneric(now, duration);
    }
  }

  /**
   * Play Dha (bass sound - dayan + bayan)
   */
  private playDha(time: number, duration: number): void {
    if (!this.audioContext) return;

    // Low frequency component (bayan)
    const lowOsc = this.audioContext.createOscillator();
    const lowGain = this.audioContext.createGain();

    lowOsc.connect(lowGain);
    lowGain.connect(this.audioContext.destination);

    lowOsc.frequency.setValueAtTime(80, time);
    lowOsc.frequency.exponentialRampToValueAtTime(40, time + duration);
    lowOsc.type = 'sine';

    lowGain.gain.setValueAtTime(0.8, time);
    lowGain.gain.exponentialRampToValueAtTime(0.01, time + duration);

    lowOsc.start(time);
    lowOsc.stop(time + duration);

    // Mid frequency resonance
    const midOsc = this.audioContext.createOscillator();
    const midGain = this.audioContext.createGain();

    midOsc.connect(midGain);
    midGain.connect(this.audioContext.destination);

    midOsc.frequency.setValueAtTime(150, time);
    midOsc.frequency.exponentialRampToValueAtTime(100, time + duration * 0.5);
    midOsc.type = 'triangle';

    midGain.gain.setValueAtTime(0.4, time);
    midGain.gain.exponentialRampToValueAtTime(0.01, time + duration * 0.6);

    midOsc.start(time);
    midOsc.stop(time + duration);
  }

  /**
   * Play Ti (high pitched, short sound - dayan)
   */
  private playTi(time: number, duration: number): void {
    if (!this.audioContext) return;

    // High frequency component
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.audioContext.destination);

    osc.frequency.setValueAtTime(800, time);
    osc.frequency.exponentialRampToValueAtTime(400, time + duration);
    osc.type = 'square';

    filter.type = 'bandpass';
    filter.frequency.value = 1000;
    filter.Q.value = 3;

    gain.gain.setValueAtTime(0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + duration * 0.8);

    osc.start(time);
    osc.stop(time + duration);
  }

  /**
   * Play Ta (sharp attack, mid tone)
   */
  private playTa(time: number, duration: number): void {
    if (!this.audioContext) return;

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    const noise = this.createNoiseNode();
    const noiseGain = this.audioContext.createGain();

    osc.connect(gain);
    gain.connect(this.audioContext.destination);

    if (noise) {
      noise.connect(noiseGain);
      noiseGain.connect(this.audioContext.destination);

      noiseGain.gain.setValueAtTime(0.2, time);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, time + duration * 0.3);
    }

    osc.frequency.setValueAtTime(300, time);
    osc.frequency.exponentialRampToValueAtTime(200, time + duration);
    osc.type = 'sawtooth';

    gain.gain.setValueAtTime(0.6, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + duration);

    osc.start(time);
    osc.stop(time + duration);
  }

  /**
   * Play Ge/Ka (resonant, medium pitch)
   */
  private playGe(time: number, duration: number): void {
    if (!this.audioContext) return;

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.connect(gain);
    gain.connect(this.audioContext.destination);

    osc.frequency.setValueAtTime(250, time);
    osc.frequency.exponentialRampToValueAtTime(150, time + duration);
    osc.type = 'triangle';

    gain.gain.setValueAtTime(0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + duration);

    osc.start(time);
    osc.stop(time + duration);
  }

  /**
   * Play Na (bass resonance)
   */
  private playNa(time: number, duration: number): void {
    if (!this.audioContext) return;

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.connect(gain);
    gain.connect(this.audioContext.destination);

    osc.frequency.setValueAtTime(120, time);
    osc.frequency.exponentialRampToValueAtTime(80, time + duration);
    osc.type = 'sine';

    gain.gain.setValueAtTime(0.7, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + duration);

    osc.start(time);
    osc.stop(time + duration);
  }

  /**
   * Play generic percussion sound
   */
  private playGeneric(time: number, duration: number): void {
    if (!this.audioContext) return;

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.connect(gain);
    gain.connect(this.audioContext.destination);

    osc.frequency.setValueAtTime(200, time);
    osc.frequency.exponentialRampToValueAtTime(100, time + duration);
    osc.type = 'triangle';

    gain.gain.setValueAtTime(0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + duration);

    osc.start(time);
    osc.stop(time + duration);
  }

  /**
   * Create a noise source for realistic percussion
   */
  private createNoiseNode(): AudioBufferSourceNode | null {
    if (!this.audioContext) return null;

    const bufferSize = this.audioContext.sampleRate * 0.1;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const output = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const noise = this.audioContext.createBufferSource();
    noise.buffer = buffer;

    return noise;
  }

  /**
   * Start recording tabla audio
   */
  async startRecording(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      this.mediaRecorder = new MediaRecorder(stream);
      this.recordedChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.processRecording();
      };

      this.mediaRecorder.start();
      this.isRecording = true;
    } catch (error) {
      console.error('Error starting recording:', error);
      throw error;
    }
  }

  /**
   * Stop recording tabla audio
   */
  stopRecording(): void {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;

      // Stop all tracks
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
  }

  /**
   * Process recorded audio and detect tabla bols
   */
  private async processRecording(): Promise<void> {
    const audioBlob = new Blob(this.recordedChunks, { type: 'audio/webm' });

    // This is a placeholder for actual rhythm detection
    // In a real implementation, you would use Web Audio API to analyze
    // the audio buffer and detect rhythm patterns

    // Simulate detection (you would implement actual DSP here)
    const mockData: TablaRecordingData = {
      bols: ['धा', 'धिं', 'धिं', 'धा'],
      timings: [0, 0.5, 1.0, 1.5],
      duration: 2.0
    };

    this.recordingCompleteSubject.next(mockData);
  }

  /**
   * Auto-detect tabla bols from audio buffer
   * This is a simplified implementation
   */
  async analyzeRhythm(audioBuffer: AudioBuffer): Promise<string[]> {
    // Placeholder for rhythm analysis
    // In production, you would implement:
    // 1. Onset detection (finding when beats occur)
    // 2. Spectral analysis (determining what type of bol)
    // 3. Pattern matching (matching to known tabla bols)

    // For now, return a simple pattern
    return ['धा', 'धिं', 'धिं', 'धा'];
  }

  getIsRecording(): boolean {
    return this.isRecording;
  }
}
