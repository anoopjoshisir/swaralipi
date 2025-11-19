import { Injectable } from '@angular/core';
import { BehaviorSubject, interval, Subscription } from 'rxjs';
import { NotationGrid, PlaybackState, CellPosition } from '../models/notation.model';

export interface Recording {
  id: string;
  compositionId?: string;
  title: string;
  audioBlob?: Blob;
  audioUrl?: string;
  duration: number; // in seconds
  createdAt: Date;
  waveformData?: number[]; // For visualization
  metadata: {
    tempo: number;
    taal: string;
    recordedWith: 'microphone' | 'playback';
  };
}

export interface PracticeSession {
  id: string;
  compositionId: string;
  startedAt: Date;
  endedAt?: Date;
  duration: number; // in seconds
  tempo: number;
  loops: number;
  mistakes: PracticeMistake[];
  score: number; // 0-100
}

export interface PracticeMistake {
  time: number; // seconds from start
  cellPosition: CellPosition;
  expected: string;
  actual?: string;
  type: 'timing' | 'note' | 'rhythm';
}

export interface PracticeSettings {
  loopEnabled: boolean;
  loopStart?: number; // row index
  loopEnd?: number; // row index
  metronomeEnabled: boolean;
  countIn: number; // number of beats before starting
  autoScroll: boolean;
  highlightCurrent: boolean;
  speedControl: number; // 0.25 to 2.0 (percentage of original tempo)
}

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number; // current recording duration in seconds
  volume: number; // input volume level 0-1
}

@Injectable({
  providedIn: 'root'
})
export class RecordingPracticeService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private recordings: Map<string, Recording> = new Map();
  private practiceSessions: Map<string, PracticeSession> = new Map();

  private recordingStateSubject = new BehaviorSubject<RecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    volume: 0
  });

  private practiceSettingsSubject = new BehaviorSubject<PracticeSettings>({
    loopEnabled: false,
    metronomeEnabled: true,
    countIn: 4,
    autoScroll: true,
    highlightCurrent: true,
    speedControl: 1.0
  });

  private currentSessionSubject = new BehaviorSubject<PracticeSession | null>(null);

  public recordingState$ = this.recordingStateSubject.asObservable();
  public practiceSettings$ = this.practiceSettingsSubject.asObservable();
  public currentSession$ = this.currentSessionSubject.asObservable();

  private recordingStartTime: number = 0;
  private recordingTimer: Subscription | null = null;
  private volumeMeterTimer: Subscription | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;

  constructor() {
    this.loadFromLocalStorage();
  }

  private loadFromLocalStorage(): void {
    const stored = localStorage.getItem('swaralipi_recordings');
    if (stored) {
      try {
        const data = JSON.parse(stored);
        // Note: Blob data won't survive localStorage, would need IndexedDB for that
        this.recordings = new Map(Object.entries(data));
      } catch (error) {
        console.error('Error loading recordings:', error);
      }
    }

    const storedSessions = localStorage.getItem('swaralipi_practice_sessions');
    if (storedSessions) {
      try {
        const data = JSON.parse(storedSessions);
        this.practiceSessions = new Map(Object.entries(data));
      } catch (error) {
        console.error('Error loading practice sessions:', error);
      }
    }
  }

  private saveToLocalStorage(): void {
    // Save recordings metadata (without blobs)
    const recordingsData = Array.from(this.recordings.entries()).map(([id, rec]) => [
      id,
      {
        ...rec,
        audioBlob: undefined // Don't store blob in localStorage
      }
    ]);
    localStorage.setItem('swaralipi_recordings', JSON.stringify(Object.fromEntries(recordingsData)));

    // Save practice sessions
    localStorage.setItem('swaralipi_practice_sessions', JSON.stringify(Object.fromEntries(this.practiceSessions)));
  }

  // Recording functionality
  async startRecording(title?: string): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(stream);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.saveRecording(audioBlob, title);
      };

      // Setup volume monitoring
      this.setupVolumeMeter(stream);

      this.mediaRecorder.start(100); // Collect data every 100ms
      this.recordingStartTime = Date.now();

      // Start timer
      this.recordingTimer = interval(100).subscribe(() => {
        const duration = (Date.now() - this.recordingStartTime) / 1000;
        const state = this.recordingStateSubject.value;
        this.recordingStateSubject.next({
          ...state,
          duration
        });
      });

      const state = this.recordingStateSubject.value;
      this.recordingStateSubject.next({
        ...state,
        isRecording: true,
        isPaused: false
      });

    } catch (error) {
      console.error('Error starting recording:', error);
      throw new Error('Failed to access microphone');
    }
  }

  pauseRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();

      const state = this.recordingStateSubject.value;
      this.recordingStateSubject.next({
        ...state,
        isPaused: true
      });
    }
  }

  resumeRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();

      const state = this.recordingStateSubject.value;
      this.recordingStateSubject.next({
        ...state,
        isPaused: false
      });
    }
  }

  stopRecording(): void {
    if (this.mediaRecorder) {
      this.mediaRecorder.stop();

      // Stop all tracks
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());

      // Stop timers
      if (this.recordingTimer) {
        this.recordingTimer.unsubscribe();
        this.recordingTimer = null;
      }

      if (this.volumeMeterTimer) {
        this.volumeMeterTimer.unsubscribe();
        this.volumeMeterTimer = null;
      }

      const state = this.recordingStateSubject.value;
      this.recordingStateSubject.next({
        isRecording: false,
        isPaused: false,
        duration: 0,
        volume: 0
      });
    }
  }

  private setupVolumeMeter(stream: MediaStream): void {
    this.audioContext = new AudioContext();
    const source = this.audioContext.createMediaStreamSource(stream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;

    source.connect(this.analyser);

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    this.volumeMeterTimer = interval(50).subscribe(() => {
      if (this.analyser) {
        this.analyser.getByteFrequencyData(dataArray);

        // Calculate average volume
        const average = dataArray.reduce((a, b) => a + b, 0) / bufferLength;
        const volume = average / 255;

        const state = this.recordingStateSubject.value;
        this.recordingStateSubject.next({
          ...state,
          volume
        });
      }
    });
  }

  private saveRecording(audioBlob: Blob, title?: string): void {
    const recording: Recording = {
      id: this.generateId('rec'),
      title: title || `Recording ${new Date().toLocaleString()}`,
      audioBlob,
      audioUrl: URL.createObjectURL(audioBlob),
      duration: this.recordingStateSubject.value.duration,
      createdAt: new Date(),
      metadata: {
        tempo: 120,
        taal: '',
        recordedWith: 'microphone'
      }
    };

    this.recordings.set(recording.id, recording);
    this.saveToLocalStorage();
  }

  getRecording(id: string): Recording | undefined {
    return this.recordings.get(id);
  }

  getAllRecordings(): Recording[] {
    return Array.from(this.recordings.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  deleteRecording(id: string): boolean {
    const recording = this.recordings.get(id);
    if (recording && recording.audioUrl) {
      URL.revokeObjectURL(recording.audioUrl);
    }

    const deleted = this.recordings.delete(id);
    if (deleted) {
      this.saveToLocalStorage();
    }

    return deleted;
  }

  downloadRecording(id: string): void {
    const recording = this.recordings.get(id);
    if (recording && recording.audioBlob) {
      const url = URL.createObjectURL(recording.audioBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${recording.title}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }

  // Practice functionality
  startPracticeSession(compositionId: string, tempo: number): PracticeSession {
    const session: PracticeSession = {
      id: this.generateId('session'),
      compositionId,
      startedAt: new Date(),
      duration: 0,
      tempo,
      loops: 0,
      mistakes: [],
      score: 100
    };

    this.currentSessionSubject.next(session);
    return session;
  }

  endPracticeSession(): PracticeSession | null {
    const session = this.currentSessionSubject.value;
    if (!session) return null;

    session.endedAt = new Date();
    session.duration = (session.endedAt.getTime() - session.startedAt.getTime()) / 1000;

    // Calculate score based on mistakes
    const mistakeCount = session.mistakes.length;
    session.score = Math.max(0, 100 - mistakeCount * 5);

    this.practiceSessions.set(session.id, session);
    this.saveToLocalStorage();

    this.currentSessionSubject.next(null);
    return session;
  }

  recordMistake(
    cellPosition: CellPosition,
    expected: string,
    actual: string | undefined,
    type: PracticeMistake['type']
  ): void {
    const session = this.currentSessionSubject.value;
    if (!session) return;

    const time = (Date.now() - session.startedAt.getTime()) / 1000;

    session.mistakes.push({
      time,
      cellPosition,
      expected,
      actual,
      type
    });

    this.currentSessionSubject.next(session);
  }

  incrementLoop(): void {
    const session = this.currentSessionSubject.value;
    if (session) {
      session.loops++;
      this.currentSessionSubject.next(session);
    }
  }

  getPracticeSessions(compositionId?: string): PracticeSession[] {
    const sessions = Array.from(this.practiceSessions.values());

    if (compositionId) {
      return sessions.filter(s => s.compositionId === compositionId)
        .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
    }

    return sessions.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  }

  getPracticeStats(compositionId: string): {
    totalSessions: number;
    totalDuration: number;
    averageScore: number;
    totalMistakes: number;
    improvementTrend: number; // Positive = improving, negative = declining
  } {
    const sessions = this.getPracticeSessions(compositionId);

    if (sessions.length === 0) {
      return {
        totalSessions: 0,
        totalDuration: 0,
        averageScore: 0,
        totalMistakes: 0,
        improvementTrend: 0
      };
    }

    const totalDuration = sessions.reduce((sum, s) => sum + s.duration, 0);
    const averageScore = sessions.reduce((sum, s) => sum + s.score, 0) / sessions.length;
    const totalMistakes = sessions.reduce((sum, s) => sum + s.mistakes.length, 0);

    // Calculate improvement trend (compare last 5 vs previous 5)
    let improvementTrend = 0;
    if (sessions.length >= 10) {
      const recent = sessions.slice(0, 5);
      const previous = sessions.slice(5, 10);

      const recentAvg = recent.reduce((sum, s) => sum + s.score, 0) / 5;
      const previousAvg = previous.reduce((sum, s) => sum + s.score, 0) / 5;

      improvementTrend = recentAvg - previousAvg;
    }

    return {
      totalSessions: sessions.length,
      totalDuration,
      averageScore,
      totalMistakes,
      improvementTrend
    };
  }

  // Practice settings
  updatePracticeSettings(settings: Partial<PracticeSettings>): void {
    const current = this.practiceSettingsSubject.value;
    this.practiceSettingsSubject.next({
      ...current,
      ...settings
    });
  }

  getPracticeSettings(): PracticeSettings {
    return this.practiceSettingsSubject.value;
  }

  // Metronome functionality
  private metronomeInterval: Subscription | null = null;
  private audioContextForMetronome: AudioContext | null = null;

  startMetronome(tempo: number): void {
    this.stopMetronome(); // Stop if already running

    const interval_ms = (60 / tempo) * 1000;

    this.audioContextForMetronome = new AudioContext();

    let beatCount = 0;
    this.metronomeInterval = interval(interval_ms).subscribe(() => {
      this.playMetronomeClick(beatCount === 0);
      beatCount = (beatCount + 1) % 4;
    });
  }

  stopMetronome(): void {
    if (this.metronomeInterval) {
      this.metronomeInterval.unsubscribe();
      this.metronomeInterval = null;
    }
  }

  private playMetronomeClick(isDownbeat: boolean): void {
    if (!this.audioContextForMetronome) return;

    const oscillator = this.audioContextForMetronome.createOscillator();
    const gainNode = this.audioContextForMetronome.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContextForMetronome.destination);

    oscillator.frequency.value = isDownbeat ? 1000 : 800;
    gainNode.gain.value = 0.3;

    oscillator.start();
    oscillator.stop(this.audioContextForMetronome.currentTime + 0.05);
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
