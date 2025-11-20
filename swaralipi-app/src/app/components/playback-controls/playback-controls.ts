import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil, interval } from 'rxjs';
import { NotationService } from '../../services/notation';
import { AudioService } from '../../services/audio';
import { TablaService } from '../../services/tabla';
import { NotationCell, PlaybackState } from '../../models/notation.model';

@Component({
  selector: 'app-playback-controls',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './playback-controls.html',
  styleUrls: ['./playback-controls.scss']
})
export class PlaybackControls implements OnInit, OnDestroy {
  isPlaying = false;
  isPaused = false;
  currentBeat = 0;
  currentRow = 0;
  currentCol = 1;
  tempo = 120; // BPM
  volume = 0.7;

  private destroy$ = new Subject<void>();
  private playbackInterval: any = null;
  private beatDuration = 500; // milliseconds per beat

  constructor(
    private notationService: NotationService,
    private audioService: AudioService,
    private tablaService: TablaService
  ) {}

  ngOnInit(): void {
    // Subscribe to tempo changes from metadata
    this.notationService.metadata$
      .pipe(takeUntil(this.destroy$))
      .subscribe(metadata => {
        if (metadata.tempo) {
          this.tempo = metadata.tempo;
          this.updateBeatDuration();
        }
      });
  }

  ngOnDestroy(): void {
    this.stop();
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Start playback from the beginning or current position
   */
  play(): void {
    if (this.isPlaying && !this.isPaused) return;

    this.isPlaying = true;
    this.isPaused = false;

    // Resume audio context if needed
    this.audioService.resumeAudioContext();

    // If starting fresh, reset position
    if (this.currentRow === 0 && this.currentCol === 1) {
      this.resetPlaybackPosition();
    }

    this.startPlaybackLoop();
  }

  /**
   * Pause playback at current position
   */
  pause(): void {
    if (!this.isPlaying) return;

    this.isPaused = true;
    this.isPlaying = false;

    if (this.playbackInterval) {
      clearInterval(this.playbackInterval);
      this.playbackInterval = null;
    }

    this.audioService.stopAll();
  }

  /**
   * Stop playback and reset to beginning
   */
  stop(): void {
    this.isPlaying = false;
    this.isPaused = false;

    if (this.playbackInterval) {
      clearInterval(this.playbackInterval);
      this.playbackInterval = null;
    }

    this.audioService.stopAll();
    this.resetPlaybackPosition();
  }

  /**
   * Toggle between play and pause
   */
  togglePlayPause(): void {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  /**
   * Change tempo (BPM)
   */
  onTempoChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.tempo = parseInt(input.value, 10);
    this.updateBeatDuration();
    this.notationService.updateMetadata({ tempo: this.tempo });

    // If playing, restart the loop with new tempo
    if (this.isPlaying) {
      this.pause();
      this.play();
    }
  }

  /**
   * Change volume
   */
  onVolumeChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.volume = parseFloat(input.value);
    this.audioService.setVolume(this.volume);
  }

  /**
   * Update beat duration based on tempo
   */
  private updateBeatDuration(): void {
    // Convert BPM to milliseconds per beat
    this.beatDuration = (60 / this.tempo) * 1000;
  }

  /**
   * Reset playback position to the beginning
   */
  private resetPlaybackPosition(): void {
    this.currentRow = 0;
    this.currentCol = 1;
    this.currentBeat = 0;
  }

  /**
   * Start the playback loop
   */
  private startPlaybackLoop(): void {
    const grid = this.notationService.getGrid();
    const colCount = this.notationService.getColCount();
    const rowCount = this.notationService.getRowCount();

    if (!grid || rowCount === 0) return;

    // Play current cell immediately
    this.playCell(this.currentRow, this.currentCol);

    // Set up interval for subsequent beats
    this.playbackInterval = setInterval(() => {
      // Move to next beat
      this.currentCol++;
      this.currentBeat++;

      // Check if we've reached the end of the row
      if (this.currentCol >= colCount) {
        this.currentCol = 1;
        this.currentRow++;

        // Check if we've reached the end of the grid
        if (this.currentRow >= rowCount) {
          // Loop back to the beginning
          this.currentRow = 0;
          this.currentBeat = 0;
        }
      }

      // Play the cell
      this.playCell(this.currentRow, this.currentCol);

      // Highlight current cell
      this.notationService.selectCell({ row: this.currentRow, col: this.currentCol });

    }, this.beatDuration);
  }

  /**
   * Play a specific cell's content
   */
  private playCell(row: number, col: number): void {
    const cell = this.notationService.getCell(row, col);
    if (!cell) return;

    // Play swar if present
    if (cell.swar && cell.swar !== '-' && cell.swar !== '') {
      this.audioService.playSwar(cell.swar, cell.modifiers, this.beatDuration / 1000);
    }

    // Play tabla bol if present
    if (cell.bol && cell.bol !== '-' && cell.bol !== '') {
      this.tablaService.playBol(cell.bol, this.beatDuration / 1000);
    }
  }

  /**
   * Play only from the current row
   */
  playFromCurrentRow(): void {
    const selectedCell = this.notationService.getSelectedCell();
    this.currentRow = selectedCell.row;
    this.currentCol = 1;
    this.play();
  }

  /**
   * Skip to next row
   */
  nextRow(): void {
    const rowCount = this.notationService.getRowCount();
    if (this.currentRow < rowCount - 1) {
      this.currentRow++;
      this.currentCol = 1;

      if (this.isPlaying) {
        this.pause();
        this.play();
      }
    }
  }

  /**
   * Skip to previous row
   */
  previousRow(): void {
    if (this.currentRow > 0) {
      this.currentRow--;
      this.currentCol = 1;

      if (this.isPlaying) {
        this.pause();
        this.play();
      }
    }
  }

  /**
   * Toggle loop mode
   */
  loopEnabled = true;
  toggleLoop(): void {
    this.loopEnabled = !this.loopEnabled;
  }
}
