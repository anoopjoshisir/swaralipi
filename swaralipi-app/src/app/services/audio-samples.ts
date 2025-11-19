import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface AudioSample {
  id: string;
  name: string;
  url: string;
  buffer?: AudioBuffer;
  instrument: 'swar' | 'tabla' | 'tanpura' | 'harmonium';
  note?: string; // For swar samples
  bol?: string; // For tabla samples
  duration: number;
  sampleRate: number;
}

export interface SamplePack {
  id: string;
  name: string;
  description: string;
  instrument: AudioSample['instrument'];
  samples: AudioSample[];
  author: string;
  version: string;
  isLoaded: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AudioSamplesService {
  private audioContext: AudioContext | null = null;
  private samplePacks: Map<string, SamplePack> = new Map();
  private loadedSamples: Map<string, AudioBuffer> = new Map();

  private loadingStateSubject = new BehaviorSubject<{
    isLoading: boolean;
    progress: number;
    currentPack?: string;
  }>({
    isLoading: false,
    progress: 0
  });

  public loadingState$ = this.loadingStateSubject.asObservable();

  constructor() {
    this.initializeAudioContext();
    this.registerDefaultSamplePacks();
  }

  private initializeAudioContext(): void {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.error('Web Audio API is not supported', error);
    }
  }

  private registerDefaultSamplePacks(): void {
    // Register Swar Sample Pack
    this.samplePacks.set('swar_classical', {
      id: 'swar_classical',
      name: 'Classical Swar Samples',
      description: 'High-quality vocal swar samples recorded in classical style',
      instrument: 'swar',
      samples: this.generateSwarSamples(),
      author: 'Swaralipi Team',
      version: '1.0',
      isLoaded: false
    });

    // Register Tabla Sample Pack
    this.samplePacks.set('tabla_traditional', {
      id: 'tabla_traditional',
      name: 'Traditional Tabla Samples',
      description: 'Authentic tabla bol samples',
      instrument: 'tabla',
      samples: this.generateTablaSamples(),
      author: 'Swaralipi Team',
      version: '1.0',
      isLoaded: false
    });

    // Register Tanpura Sample Pack
    this.samplePacks.set('tanpura_drone', {
      id: 'tanpura_drone',
      name: 'Tanpura Drone',
      description: 'Continuous tanpura drone in various scales',
      instrument: 'tanpura',
      samples: this.generateTanpuraSamples(),
      author: 'Swaralipi Team',
      version: '1.0',
      isLoaded: false
    });

    // Register Harmonium Sample Pack
    this.samplePacks.set('harmonium_basic', {
      id: 'harmonium_basic',
      name: 'Basic Harmonium',
      description: 'Harmonium samples for all notes',
      instrument: 'harmonium',
      samples: this.generateHarmoniumSamples(),
      author: 'Swaralipi Team',
      version: '1.0',
      isLoaded: false
    });
  }

  private generateSwarSamples(): AudioSample[] {
    const swars = ['सा', 'रे॒', 'रे', 'ग॒', 'ग', 'म', 'म॑', 'प', 'ध॒', 'ध', 'नी॒', 'नी'];
    const frequencies = [261.63, 277.18, 293.66, 311.13, 329.63, 349.23, 369.99, 392.00, 415.30, 440.00, 466.16, 493.88];

    return swars.map((swar, index) => ({
      id: `swar_${swar}`,
      name: `Swar ${swar}`,
      url: `/assets/audio/swars/${swar}.mp3`, // In production, point to real audio files
      instrument: 'swar' as const,
      note: swar,
      duration: 1.5,
      sampleRate: 44100
    }));
  }

  private generateTablaSamples(): AudioSample[] {
    const bols = ['धा', 'धिं', 'धिर', 'धिन', 'ता', 'ति', 'तिं', 'तिरकिट', 'का', 'गे', 'ना', 'दिन'];

    return bols.map(bol => ({
      id: `tabla_${bol}`,
      name: `Tabla ${bol}`,
      url: `/assets/audio/tabla/${bol}.mp3`,
      instrument: 'tabla' as const,
      bol: bol,
      duration: 0.5,
      sampleRate: 44100
    }));
  }

  private generateTanpuraSamples(): AudioSample[] {
    const scales = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    return scales.map(scale => ({
      id: `tanpura_${scale}`,
      name: `Tanpura ${scale}`,
      url: `/assets/audio/tanpura/${scale}.mp3`,
      instrument: 'tanpura' as const,
      note: scale,
      duration: 60, // Long drone sample
      sampleRate: 44100
    }));
  }

  private generateHarmoniumSamples(): AudioSample[] {
    const notes = ['Sa', 'Re_k', 'Re', 'Ga_k', 'Ga', 'Ma', 'Ma_t', 'Pa', 'Dha_k', 'Dha', 'Ni_k', 'Ni'];

    return notes.map(note => ({
      id: `harmonium_${note}`,
      name: `Harmonium ${note}`,
      url: `/assets/audio/harmonium/${note}.mp3`,
      instrument: 'harmonium' as const,
      note: note,
      duration: 2.0,
      sampleRate: 44100
    }));
  }

  async loadSamplePack(packId: string): Promise<boolean> {
    const pack = this.samplePacks.get(packId);
    if (!pack) {
      console.error(`Sample pack ${packId} not found`);
      return false;
    }

    if (pack.isLoaded) {
      return true; // Already loaded
    }

    this.loadingStateSubject.next({
      isLoading: true,
      progress: 0,
      currentPack: pack.name
    });

    try {
      const totalSamples = pack.samples.length;
      let loadedCount = 0;

      for (const sample of pack.samples) {
        try {
          await this.loadSample(sample);
          loadedCount++;

          this.loadingStateSubject.next({
            isLoading: true,
            progress: (loadedCount / totalSamples) * 100,
            currentPack: pack.name
          });
        } catch (error) {
          console.error(`Failed to load sample ${sample.id}:`, error);
          // Continue loading other samples
        }
      }

      pack.isLoaded = true;

      this.loadingStateSubject.next({
        isLoading: false,
        progress: 100
      });

      return true;
    } catch (error) {
      console.error(`Failed to load sample pack ${packId}:`, error);

      this.loadingStateSubject.next({
        isLoading: false,
        progress: 0
      });

      return false;
    }
  }

  private async loadSample(sample: AudioSample): Promise<void> {
    if (!this.audioContext) {
      throw new Error('Audio context not initialized');
    }

    // Check if already loaded
    if (this.loadedSamples.has(sample.id)) {
      return;
    }

    // In production, this would fetch the actual audio file
    // For now, we'll generate a synthetic tone
    const buffer = await this.generateSyntheticSample(sample);

    sample.buffer = buffer;
    this.loadedSamples.set(sample.id, buffer);
  }

  private async generateSyntheticSample(sample: AudioSample): Promise<AudioBuffer> {
    if (!this.audioContext) {
      throw new Error('Audio context not initialized');
    }

    const sampleRate = this.audioContext.sampleRate;
    const duration = sample.duration;
    const buffer = this.audioContext.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    // Generate a simple sine wave (in production, this would be real audio data)
    const frequency = this.getSampleFrequency(sample);
    const amplitude = 0.3;

    for (let i = 0; i < buffer.length; i++) {
      const time = i / sampleRate;
      data[i] = amplitude * Math.sin(2 * Math.PI * frequency * time) * Math.exp(-time * 0.5);
    }

    return buffer;
  }

  private getSampleFrequency(sample: AudioSample): number {
    // Map notes to frequencies
    const frequencyMap: { [key: string]: number } = {
      'सा': 261.63, 'रे॒': 277.18, 'रे': 293.66, 'ग॒': 311.13,
      'ग': 329.63, 'म': 349.23, 'म॑': 369.99, 'प': 392.00,
      'ध॒': 415.30, 'ध': 440.00, 'नी॒': 466.16, 'नी': 493.88
    };

    if (sample.instrument === 'swar' && sample.note) {
      return frequencyMap[sample.note] || 261.63;
    }

    // For tabla, use lower frequencies
    if (sample.instrument === 'tabla') {
      return 100 + Math.random() * 100; // Random percussion frequency
    }

    // Default frequency
    return 261.63;
  }

  async playSample(sampleId: string, volume: number = 0.8, pitch: number = 1.0): Promise<void> {
    if (!this.audioContext) return;

    const buffer = this.loadedSamples.get(sampleId);
    if (!buffer) {
      console.warn(`Sample ${sampleId} not loaded`);
      return;
    }

    const source = this.audioContext.createBufferSource();
    const gainNode = this.audioContext.createGain();

    source.buffer = buffer;
    source.playbackRate.value = pitch;

    gainNode.gain.value = volume;

    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    source.start(0);
  }

  async playSwar(swar: string, octave: 'lower' | 'middle' | 'upper' = 'middle'): Promise<void> {
    const sampleId = `swar_${swar}`;
    const pitch = octave === 'lower' ? 0.5 : octave === 'upper' ? 2.0 : 1.0;

    await this.playSample(sampleId, 0.8, pitch);
  }

  async playTabla(bol: string, volume: number = 0.8): Promise<void> {
    const sampleId = `tabla_${bol}`;
    await this.playSample(sampleId, volume);
  }

  async startTanpuraDrone(scale: string = 'C', volume: number = 0.3): Promise<void> {
    const sampleId = `tanpura_${scale}`;
    await this.playSample(sampleId, volume);
  }

  getSamplePacks(): SamplePack[] {
    return Array.from(this.samplePacks.values());
  }

  getSamplePack(packId: string): SamplePack | undefined {
    return this.samplePacks.get(packId);
  }

  isSamplePackLoaded(packId: string): boolean {
    const pack = this.samplePacks.get(packId);
    return pack?.isLoaded || false;
  }

  unloadSamplePack(packId: string): void {
    const pack = this.samplePacks.get(packId);
    if (!pack) return;

    // Remove samples from loaded cache
    pack.samples.forEach(sample => {
      this.loadedSamples.delete(sample.id);
      sample.buffer = undefined;
    });

    pack.isLoaded = false;
  }

  getLoadedMemoryUsage(): number {
    let totalSize = 0;

    for (const buffer of this.loadedSamples.values()) {
      // Estimate size: channels * length * 4 bytes per float32
      totalSize += buffer.numberOfChannels * buffer.length * 4;
    }

    return totalSize;
  }

  // Custom sample pack management
  async addCustomSamplePack(pack: SamplePack): Promise<void> {
    this.samplePacks.set(pack.id, pack);
  }

  removeSamplePack(packId: string): boolean {
    if (packId.startsWith('swar_') || packId.startsWith('tabla_') ||
        packId.startsWith('tanpura_') || packId.startsWith('harmonium_')) {
      return false; // Cannot remove default packs
    }

    this.unloadSamplePack(packId);
    return this.samplePacks.delete(packId);
  }
}
