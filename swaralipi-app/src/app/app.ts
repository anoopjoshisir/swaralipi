import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { NotationGrid } from './components/notation-grid/notation-grid';
import { NotationService } from './services/notation';
import { AudioService } from './services/audio';
import { TablaService } from './services/tabla';
import { TAAL_STRUCTURES } from './models/notation.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NotationGrid],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class App {
  title = 'स्वरलिपि - Swaralipi Music Notation Editor';
  taals = Object.keys(TAAL_STRUCTURES);

  constructor(
    public notationService: NotationService,
    public audioService: AudioService,
    public tablaService: TablaService
  ) {}

  onTaalChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.notationService.changeTaal(select.value);
  }

  onTempoChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.notationService.updateMetadata({ tempo: parseInt(input.value, 10) });
  }

  saveComposition(): void {
    const json = this.notationService.exportToJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'composition.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  loadComposition(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event: any) => {
        this.notationService.importFromJSON(event.target.result);
      };
      reader.readAsText(file);
    };
    input.click();
  }

  clearGrid(): void {
    if (confirm('Are you sure you want to clear the entire grid?')) {
      this.notationService.clearGrid();
    }
  }

  undo(): void {
    this.notationService.undo();
  }

  redo(): void {
    this.notationService.redo();
  }
}
