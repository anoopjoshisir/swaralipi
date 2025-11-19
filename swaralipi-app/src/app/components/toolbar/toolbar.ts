import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotationService } from '../../services/notation';
import { Export } from '../../services/export';

@Component({
  selector: 'app-toolbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toolbar.html',
  styleUrls: ['./toolbar.scss'],
})
export class Toolbar {
  constructor(
    private notationService: NotationService,
    private exportService: Export
  ) {}

  /**
   * Create a new composition (clear grid)
   */
  newComposition(): void {
    if (confirm('Create a new composition? This will clear the current grid.')) {
      this.notationService.clearGrid();
    }
  }

  /**
   * Save composition to JSON file
   */
  saveComposition(): void {
    const json = this.notationService.exportToJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    // Generate filename with timestamp
    const metadata = this.notationService.getMetadata();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filename = metadata.title
      ? `${metadata.title.replace(/\s+/g, '_')}_${timestamp}.json`
      : `composition_${timestamp}.json`;

    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Load composition from JSON file
   */
  loadComposition(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event: any) => {
          const success = this.notationService.importFromJSON(event.target.result);
          if (success) {
            alert('Composition loaded successfully!');
          } else {
            alert('Error loading composition. Please check the file format.');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }

  /**
   * Export as PDF
   */
  exportAsPDF(): void {
    this.exportService.exportToPDF();
  }

  /**
   * Export as PNG image
   */
  exportAsPNG(): void {
    this.exportService.exportToPNG();
  }

  /**
   * Export as SVG
   */
  exportAsSVG(): void {
    this.exportService.exportToSVG();
  }

  /**
   * Print composition
   */
  print(): void {
    window.print();
  }

  /**
   * Undo last action
   */
  undo(): void {
    this.notationService.undo();
  }

  /**
   * Redo last undone action
   */
  redo(): void {
    this.notationService.redo();
  }

  /**
   * Insert a new row
   */
  insertRow(): void {
    const selectedCell = this.notationService.getSelectedCell();
    this.notationService.insertRow(selectedCell.row);
  }

  /**
   * Delete current row
   */
  deleteRow(): void {
    if (confirm('Delete the current row?')) {
      const selectedCell = this.notationService.getSelectedCell();
      this.notationService.deleteRow(selectedCell.row);
    }
  }

  /**
   * Show keyboard shortcuts help
   */
  showHelp(): void {
    const helpText = `
स्वरलिपि - Keyboard Shortcuts

NAVIGATION:
  ↑↓←→         Navigate cells
  Tab          Next cell
  Shift+Tab    Previous cell
  Enter        Edit mode

EDITING:
  s,r,g,m,p,d,n   Swars (सा,रे,ग,म,प,ध,नी)
  -               Rest/Gap
  ,               Continuation
  Delete/Backspace Clear cell
  Esc             Exit edit mode

MODIFIERS:
  Ctrl+L      Lower octave
  Ctrl+U      Upper octave
  Ctrl+M      Meend (glide)
  Ctrl+K      Kan (grace note)

GRID OPERATIONS:
  Ctrl+I      Insert row
  Ctrl+D      Delete row
  Ctrl+Z      Undo
  Ctrl+Y      Redo

FILE OPERATIONS:
  Ctrl+S      Save
  Ctrl+O      Open
  Ctrl+N      New
  Ctrl+P      Print
    `;
    alert(helpText);
  }

  /**
   * Show about dialog
   */
  showAbout(): void {
    const aboutText = `
स्वरलिपि - Swaralipi Music Notation Editor
Version 1.0.0

An advanced Indian Classical Music notation editor
built with Angular and TypeScript.

Features:
• Multiple Taal support (तीनताल, एकताल, झपताल, etc.)
• Real-time audio playback
• Tabla bol notation
• Export to PDF, PNG, SVG
• Keyboard shortcuts
• Undo/Redo support

© 2025 Swaralipi Project
    `;
    alert(aboutText);
  }
}
