import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SWAR_FREQUENCIES, Modifier } from '../models/notation.model';

@Injectable({
  providedIn: 'root'
})
export class AudioService {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private currentOscillators: OscillatorNode[] = [];
  private isInitialized = false;

  private isPlayingSubject = new BehaviorSubject<boolean>(false);
  public isPlaying$ = this.isPlayingSubject.asObservable();

  constructor() {}

  private initializeAudioContext(): void {
    if (!this.isInitialized) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.connect(this.audioContext.destination);
      this.masterGain.gain.value = 0.3; // Master volume
      this.isInitialized = true;
    }
  }

  /**
   * Play a single swar (note)
   * @param swar The swar to play (e.g., 'सा', 'रे', 'ग')
   * @param modifiers Array of modifiers ('lower', 'upper', etc.)
   * @param duration Duration in seconds
   */
  playSwar(swar: string, modifiers: Modifier[] = [], duration: number = 0.5): void {
    this.initializeAudioContext();

    if (!this.audioContext || !this.masterGain) return;

    // Get base frequency
    let frequency = SWAR_FREQUENCIES[swar];
    if (!frequency) {
      console.warn(`Unknown swar: ${swar}`);
      return;
    }

    // Apply octave modifiers
    if (modifiers.includes('lower')) {
      frequency = frequency / 2; // Lower octave
    } else if (modifiers.includes('upper')) {
      frequency = frequency * 2; // Upper octave
    }

    // Create oscillator
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain);

    // Configure oscillator
    oscillator.type = 'sine'; // Can be 'sine', 'square', 'sawtooth', 'triangle'
    oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);

    // ADSR envelope for natural sound
    const now = this.audioContext.currentTime;
    const attackTime = 0.05;
    const decayTime = 0.1;
    const sustainLevel = 0.7;
    const releaseTime = 0.1;

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(1, now + attackTime);
    gainNode.gain.linearRampToValueAtTime(sustainLevel, now + attackTime + decayTime);
    gainNode.gain.setValueAtTime(sustainLevel, now + duration - releaseTime);
    gainNode.gain.linearRampToValueAtTime(0, now + duration);

    // Start and stop
    oscillator.start(now);
    oscillator.stop(now + duration);

    this.currentOscillators.push(oscillator);

    // Clean up
    oscillator.onended = () => {
      const index = this.currentOscillators.indexOf(oscillator);
      if (index > -1) {
        this.currentOscillators.splice(index, 1);
      }
    };
  }

  /**
   * Play a meend (glide) between two swars
   * @param fromSwar Starting swar
   * @param toSwar Ending swar
   * @param modifiers Octave modifiers
   * @param duration Duration in seconds
   */
  playMeend(fromSwar: string, toSwar: string, modifiers: Modifier[] = [], duration: number = 0.8): void {
    this.initializeAudioContext();

    if (!this.audioContext || !this.masterGain) return;

    let fromFreq = SWAR_FREQUENCIES[fromSwar];
    let toFreq = SWAR_FREQUENCIES[toSwar];

    if (!fromFreq || !toFreq) return;

    // Apply octave modifiers
    if (modifiers.includes('lower')) {
      fromFreq /= 2;
      toFreq /= 2;
    } else if (modifiers.includes('upper')) {
      fromFreq *= 2;
      toFreq *= 2;
    }

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain);

    oscillator.type = 'sine';

    const now = this.audioContext.currentTime;

    // Glide from one frequency to another
    oscillator.frequency.setValueAtTime(fromFreq, now);
    oscillator.frequency.exponentialRampToValueAtTime(toFreq, now + duration * 0.8);

    // Envelope
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.8, now + 0.05);
    gainNode.gain.setValueAtTime(0.8, now + duration - 0.1);
    gainNode.gain.linearRampToValueAtTime(0, now + duration);

    oscillator.start(now);
    oscillator.stop(now + duration);

    this.currentOscillators.push(oscillator);
  }

  /**
   * Play a kan swar (grace note)
   * @param kanSwar The grace note
   * @param mainSwar The main note
   * @param modifiers Octave modifiers
   */
  playKan(kanSwar: string, mainSwar: string, modifiers: Modifier[] = []): void {
    this.playSwar(kanSwar, modifiers, 0.08); // Very short
    setTimeout(() => {
      this.playSwar(mainSwar, modifiers, 0.4);
    }, 80);
  }

  /**
   * Stop all currently playing sounds
   */
  stopAll(): void {
    if (this.audioContext) {
      this.currentOscillators.forEach(osc => {
        try {
          osc.stop();
        } catch (e) {
          // Already stopped
        }
      });
      this.currentOscillators = [];
    }
    this.isPlayingSubject.next(false);
  }

  /**
   * Set master volume
   * @param volume Volume level (0.0 to 1.0)
   */
  setVolume(volume: number): void {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * Get master volume
   */
  getVolume(): number {
    return this.masterGain?.gain.value || 0.3;
  }

  /**
   * Resume audio context (needed for user interaction requirements)
   */
  async resumeAudioContext(): Promise<void> {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }
}
