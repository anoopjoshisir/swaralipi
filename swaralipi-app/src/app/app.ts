import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { NotationGrid } from './components/notation-grid/notation-grid';
import { Toolbar } from './components/toolbar/toolbar';
import { Sidebar } from './components/sidebar/sidebar';
import { PlaybackControls } from './components/playback-controls/playback-controls';
import { NotationService } from './services/notation';
import { AudioService } from './services/audio';
import { TablaService } from './services/tabla';
import { Export } from './services/export';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    NotationGrid,
    Toolbar,
    Sidebar,
    PlaybackControls
  ],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class App {
  title = 'स्वरलिपि - Swaralipi Music Notation Editor';

  constructor(
    public notationService: NotationService,
    public audioService: AudioService,
    public tablaService: TablaService,
    public exportService: Export
  ) {}
}
