import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { LyricsLine, CompositionLyrics } from '../models/notation.model';

@Injectable({
  providedIn: 'root'
})
export class LyricsService {
  private lyrics: CompositionLyrics = {
    lines: [],
    showLyrics: true
  };

  private lyricsSubject = new BehaviorSubject<CompositionLyrics>(this.lyrics);
  public lyrics$ = this.lyricsSubject.asObservable();

  constructor() {}

  setLyrics(lyrics: CompositionLyrics): void {
    this.lyrics = lyrics;
    this.lyricsSubject.next(this.lyrics);
  }

  getLyrics(): CompositionLyrics {
    return { ...this.lyrics };
  }

  addLyricsLine(rowIndex: number, lyrics: string[], language?: LyricsLine['language']): void {
    const existingIndex = this.lyrics.lines.findIndex(l => l.rowIndex === rowIndex);

    const newLine: LyricsLine = {
      rowIndex,
      lyrics,
      language
    };

    if (existingIndex >= 0) {
      this.lyrics.lines[existingIndex] = newLine;
    } else {
      this.lyrics.lines.push(newLine);
      this.lyrics.lines.sort((a, b) => a.rowIndex - b.rowIndex);
    }

    this.lyricsSubject.next(this.lyrics);
  }

  removeLyricsLine(rowIndex: number): void {
    const index = this.lyrics.lines.findIndex(l => l.rowIndex === rowIndex);
    if (index >= 0) {
      this.lyrics.lines.splice(index, 1);
      this.lyricsSubject.next(this.lyrics);
    }
  }

  getLyricsForRow(rowIndex: number): LyricsLine | undefined {
    return this.lyrics.lines.find(l => l.rowIndex === rowIndex);
  }

  updateLyricsForBeat(rowIndex: number, beatIndex: number, lyric: string): void {
    const line = this.lyrics.lines.find(l => l.rowIndex === rowIndex);
    if (line) {
      line.lyrics[beatIndex] = lyric;
      this.lyricsSubject.next(this.lyrics);
    }
  }

  setLyricsVisibility(show: boolean): void {
    this.lyrics.showLyrics = show;
    this.lyricsSubject.next(this.lyrics);
  }

  toggleLyricsVisibility(): void {
    this.lyrics.showLyrics = !this.lyrics.showLyrics;
    this.lyricsSubject.next(this.lyrics);
  }

  clearAllLyrics(): void {
    this.lyrics.lines = [];
    this.lyricsSubject.next(this.lyrics);
  }

  // Parse lyrics from text with automatic beat alignment
  parseLyricsFromText(text: string, beatsPerLine: number): void {
    const lines = text.split('\n').filter(l => l.trim());
    this.lyrics.lines = [];

    lines.forEach((line, index) => {
      const words = line.trim().split(/\s+/);
      const lyrics: string[] = [];

      // Distribute words across beats
      const wordsPerBeat = Math.ceil(words.length / beatsPerLine);
      for (let i = 0; i < beatsPerLine; i++) {
        const start = i * wordsPerBeat;
        const end = Math.min(start + wordsPerBeat, words.length);
        lyrics.push(words.slice(start, end).join(' '));
      }

      this.lyrics.lines.push({
        rowIndex: index,
        lyrics,
        language: this.detectLanguage(line)
      });
    });

    this.lyricsSubject.next(this.lyrics);
  }

  private detectLanguage(text: string): LyricsLine['language'] {
    // Simple language detection based on character ranges
    const devanagariRegex = /[\u0900-\u097F]/;
    const urduRegex = /[\u0600-\u06FF]/;
    const englishRegex = /^[A-Za-z\s,.!?'-]+$/;

    if (devanagariRegex.test(text)) {
      return 'hindi';
    } else if (urduRegex.test(text)) {
      return 'urdu';
    } else if (englishRegex.test(text)) {
      return 'english';
    }
    return undefined;
  }

  exportLyricsToText(): string {
    return this.lyrics.lines
      .sort((a, b) => a.rowIndex - b.rowIndex)
      .map(line => line.lyrics.join(' '))
      .join('\n');
  }

  exportLyricsToJSON(): string {
    return JSON.stringify(this.lyrics, null, 2);
  }

  importLyricsFromJSON(json: string): boolean {
    try {
      const imported = JSON.parse(json);
      if (imported.lines && Array.isArray(imported.lines)) {
        this.lyrics = imported;
        this.lyricsSubject.next(this.lyrics);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error importing lyrics:', error);
      return false;
    }
  }

  // Adjust row indices when rows are inserted/deleted
  adjustForRowInsertion(afterRow: number): void {
    this.lyrics.lines.forEach(line => {
      if (line.rowIndex > afterRow) {
        line.rowIndex++;
      }
    });
    this.lyricsSubject.next(this.lyrics);
  }

  adjustForRowDeletion(deletedRow: number): void {
    // Remove lyrics for deleted row
    this.lyrics.lines = this.lyrics.lines.filter(l => l.rowIndex !== deletedRow);

    // Adjust indices for rows after deleted row
    this.lyrics.lines.forEach(line => {
      if (line.rowIndex > deletedRow) {
        line.rowIndex--;
      }
    });
    this.lyricsSubject.next(this.lyrics);
  }

  // Get formatted lyrics for display
  getFormattedLyrics(rowIndex: number, beatIndex: number): string {
    const line = this.getLyricsForRow(rowIndex);
    if (line && line.lyrics[beatIndex]) {
      return line.lyrics[beatIndex];
    }
    return '';
  }

  // Sync lyrics with grid columns
  syncLyricsWithGrid(rowIndex: number, totalBeats: number): void {
    const line = this.getLyricsForRow(rowIndex);
    if (line) {
      // Pad or trim lyrics array to match beats
      while (line.lyrics.length < totalBeats) {
        line.lyrics.push('');
      }
      if (line.lyrics.length > totalBeats) {
        line.lyrics = line.lyrics.slice(0, totalBeats);
      }
      this.lyricsSubject.next(this.lyrics);
    }
  }
}
