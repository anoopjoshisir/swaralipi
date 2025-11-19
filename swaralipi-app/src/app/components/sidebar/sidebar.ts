import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { NotationService } from '../../services/notation';
import { AudioService } from '../../services/audio';
import { TAAL_STRUCTURES, CompositionMetadata, SWAR_MAP, BOL_MAP } from '../../models/notation.model';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.scss'],
})
export class Sidebar implements OnInit, OnDestroy {
  metadata: CompositionMetadata = {
    raga: '',
    taal: 'teen',
    tempo: 120,
    title: '',
    artist: ''
  };

  taals = Object.keys(TAAL_STRUCTURES);
  currentTaal = TAAL_STRUCTURES['teen'];
  volume = 0.3;

  // Swar and Bol reference
  swars = ['सा', 'रे', 'ग', 'म', 'प', 'ध', 'नी'];
  bols = ['धा', 'धिं', 'धिर', 'ता', 'ति', 'तिं', 'का', 'गे', 'ना', 'दिन'];

  // Common ragas
  commonRagas = [
    'यमन',
    'भूपाली',
    'भैरवी',
    'काफी',
    'बिलावल',
    'कल्याण',
    'तोड़ी',
    'भैरव',
    'मारवा',
    'पूरिया'
  ];

  showSwarReference = true;
  showBolReference = true;
  showTaalInfo = true;

  private destroy$ = new Subject<void>();

  constructor(
    private notationService: NotationService,
    private audioService: AudioService
  ) {}

  ngOnInit(): void {
    // Subscribe to metadata changes
    this.notationService.metadata$
      .pipe(takeUntil(this.destroy$))
      .subscribe(metadata => {
        this.metadata = { ...metadata };
        if (metadata.taal) {
          this.currentTaal = TAAL_STRUCTURES[metadata.taal] || TAAL_STRUCTURES['teen'];
        }
      });

    // Get initial volume
    this.volume = this.audioService.getVolume();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Update composition title
   */
  onTitleChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.metadata.title = input.value;
    this.notationService.updateMetadata({ title: input.value });
  }

  /**
   * Update artist name
   */
  onArtistChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.metadata.artist = input.value;
    this.notationService.updateMetadata({ artist: input.value });
  }

  /**
   * Update raga
   */
  onRagaChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.metadata.raga = input.value;
    this.notationService.updateMetadata({ raga: input.value });
  }

  /**
   * Select from common ragas
   */
  selectCommonRaga(raga: string): void {
    this.metadata.raga = raga;
    this.notationService.updateMetadata({ raga });
  }

  /**
   * Change taal
   */
  onTaalChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.metadata.taal = select.value;
    this.currentTaal = TAAL_STRUCTURES[select.value];
    this.notationService.changeTaal(select.value);
  }

  /**
   * Change tempo
   */
  onTempoChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.metadata.tempo = parseInt(input.value, 10);
    this.notationService.updateMetadata({ tempo: this.metadata.tempo });
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
   * Play a swar preview
   */
  playSwarPreview(swar: string): void {
    this.audioService.playSwar(swar, [], 0.5);
  }

  /**
   * Toggle swar reference panel
   */
  toggleSwarReference(): void {
    this.showSwarReference = !this.showSwarReference;
  }

  /**
   * Toggle bol reference panel
   */
  toggleBolReference(): void {
    this.showBolReference = !this.showBolReference;
  }

  /**
   * Toggle taal info panel
   */
  toggleTaalInfo(): void {
    this.showTaalInfo = !this.showTaalInfo;
  }

  /**
   * Get taal beat pattern as string
   */
  getTaalPattern(): string {
    if (!this.currentTaal) return '';
    return this.currentTaal.vibhags.join(' + ') + ' = ' + this.currentTaal.beats + ' beats';
  }

  /**
   * Get taal markers as string
   */
  getTaalMarkers(): string {
    if (!this.currentTaal) return '';
    return this.currentTaal.markers.join(', ');
  }
}
