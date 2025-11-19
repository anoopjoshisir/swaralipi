import { Component, OnInit, HostListener, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { NotationService } from '../../services/notation';
import { AudioService } from '../../services/audio';
import { TablaService } from '../../services/tabla';
import { NotationCell, CellPosition, TaalStructure } from '../../models/notation.model';

@Component({
  selector: 'app-notation-grid',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notation-grid.html',
  styleUrls: ['./notation-grid.scss']
})
export class NotationGrid implements OnInit, OnDestroy {
  grid: NotationCell[][] = [];
  selectedCell: CellPosition = { row: 0, col: 1 };
  taalStructure: TaalStructure | null = null;
  isEditing = false;
  editMode: 'swar' | 'bol' = 'swar';
  private destroy$ = new Subject<void>();

  constructor(
    public notationService: NotationService,
    private audioService: AudioService,
    private tablaService: TablaService
  ) {}

  ngOnInit(): void {
    // Subscribe to grid changes
    this.notationService.grid$
      .pipe(takeUntil(this.destroy$))
      .subscribe(grid => {
        this.grid = grid;
      });

    // Subscribe to selected cell changes
    this.notationService.selectedCell$
      .pipe(takeUntil(this.destroy$))
      .subscribe(cell => {
        this.selectedCell = cell;
      });

    // Get taal structure
    this.taalStructure = this.notationService.getTaalStructure();

    // Subscribe to metadata changes (for taal changes)
    this.notationService.metadata$
      .pipe(takeUntil(this.destroy$))
      .subscribe(metadata => {
        if (metadata.taal) {
          this.taalStructure = this.notationService.getTaalStructure();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Handle cell click
  onCellClick(row: number, col: number, event: MouseEvent): void {
    if (col === 0) return; // Don't select header cells

    this.notationService.selectCell({ row, col });
    this.isEditing = false;

    // Play the cell content on click
    const cell = this.notationService.getCell(row, col);
    if (cell) {
      if (cell.swar) {
        this.audioService.playSwar(cell.swar, cell.modifiers);
      }
      if (cell.bol) {
        this.tablaService.playBol(cell.bol);
      }
    }
  }

  // Handle cell double click to edit
  onCellDblClick(row: number, col: number): void {
    if (col === 0) return;

    this.notationService.selectCell({ row, col });
    this.isEditing = true;
    this.editMode = 'swar'; // Default to swar editing
  }

  // Check if cell is selected
  isSelected(row: number, col: number): boolean {
    return this.selectedCell.row === row && this.selectedCell.col === col;
  }

  // Check if cell is being edited
  isCellEditing(row: number, col: number): boolean {
    return this.isEditing && this.isSelected(row, col);
  }

  // Keyboard event handler
  @HostListener('window:keydown', ['$event'])
  handleKeyboard(event: KeyboardEvent): void {
    // Don't handle if user is typing in an input field
    if ((event.target as HTMLElement).tagName === 'INPUT' ||
        (event.target as HTMLElement).tagName === 'TEXTAREA' ||
        (event.target as HTMLElement).tagName === 'SELECT') {
      return;
    }

    const { row, col } = this.selectedCell;

    // Arrow keys for navigation
    if (!this.isEditing) {
      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault();
          this.notationService.moveSelection('up');
          break;
        case 'ArrowDown':
          event.preventDefault();
          this.notationService.moveSelection('down');
          break;
        case 'ArrowLeft':
          event.preventDefault();
          this.notationService.moveSelection('left');
          break;
        case 'ArrowRight':
          event.preventDefault();
          this.notationService.moveSelection('right');
          break;
        case 'Enter':
          event.preventDefault();
          this.isEditing = true;
          this.editMode = 'swar';
          break;
        case 'Delete':
        case 'Backspace':
          event.preventDefault();
          this.notationService.clearCell(row, col);
          break;
        case 'Tab':
          event.preventDefault();
          if (event.shiftKey) {
            this.notationService.moveSelection('left');
          } else {
            this.notationService.moveSelection('right');
          }
          break;
      }

      // Quick input for swar
      this.handleQuickInput(event.key, row, col);

      // Modifiers with Ctrl
      if (event.ctrlKey) {
        this.handleModifiers(event);
      }
    } else {
      // In editing mode
      if (event.key === 'Escape') {
        event.preventDefault();
        this.isEditing = false;
      } else if (event.key === 'Enter') {
        event.preventDefault();
        if (this.editMode === 'swar') {
          this.editMode = 'bol';
        } else {
          this.isEditing = false;
          this.notationService.moveSelection('right');
        }
      } else if (event.key === 'Tab') {
        event.preventDefault();
        this.isEditing = false;
        if (event.shiftKey) {
          this.notationService.moveSelection('left');
        } else {
          this.notationService.moveSelection('right');
        }
      } else {
        // Handle input
        this.handleEditInput(event.key, row, col);
      }
    }
  }

  // Handle quick input for swar
  private handleQuickInput(key: string, row: number, col: number): void {
    const swarMap: { [key: string]: string } = {
      's': 'सा',
      'r': 'रे',
      'g': 'ग',
      'm': 'म',
      'p': 'प',
      'd': 'ध',
      'n': 'नी'
    };

    if (swarMap[key.toLowerCase()]) {
      this.notationService.setCellSwar(row, col, key);
      const cell = this.notationService.getCell(row, col);
      if (cell) {
        this.audioService.playSwar(cell.swar, cell.modifiers);
      }
    }

    // Special characters
    if (key === '-') {
      this.notationService.setCellSwar(row, col, '-');
    } else if (key === ',') {
      this.notationService.setCellSwar(row, col, ',');
    }
  }

  // Handle editing input
  private handleEditInput(key: string, row: number, col: number): void {
    if (key.length === 1 && !key.match(/[Control|Shift|Alt|Meta]/)) {
      if (this.editMode === 'swar') {
        this.notationService.setCellSwar(row, col, key);
      } else {
        this.notationService.setCellBol(row, col, key);
      }
    } else if (key === 'Backspace' || key === 'Delete') {
      if (this.editMode === 'swar') {
        this.notationService.setCellSwar(row, col, '');
      } else {
        this.notationService.setCellBol(row, col, '');
      }
    }
  }

  // Handle modifier keys
  private handleModifiers(event: KeyboardEvent): void {
    const { row, col } = this.selectedCell;

    switch (event.key.toLowerCase()) {
      case 'l':
        event.preventDefault();
        this.notationService.toggleModifier(row, col, 'lower');
        break;
      case 'u':
        event.preventDefault();
        this.notationService.toggleModifier(row, col, 'upper');
        break;
      case 'm':
        event.preventDefault();
        this.notationService.toggleModifier(row, col, 'meend');
        break;
      case 'k':
        event.preventDefault();
        this.notationService.toggleModifier(row, col, 'kan');
        break;
      case 'i':
        event.preventDefault();
        this.notationService.insertRow(row);
        break;
      case 'd':
        event.preventDefault();
        this.notationService.deleteRow(row);
        break;
      case 'z':
        event.preventDefault();
        this.notationService.undo();
        break;
      case 'y':
        event.preventDefault();
        this.notationService.redo();
        break;
    }
  }

  // Get taal marker for a column
  getTaalMarker(col: number): string {
    if (!this.taalStructure || col === 0) return '';

    let markerIndex = 0;
    let beatInVibhag = 0;
    let currentBeat = 1;

    for (let i = 1; i < col; i++) {
      beatInVibhag++;
      if (beatInVibhag >= this.taalStructure.vibhags[markerIndex]) {
        beatInVibhag = 0;
        markerIndex++;
      }
      currentBeat++;
    }

    beatInVibhag++;
    if (beatInVibhag >= this.taalStructure.vibhags[markerIndex]) {
      beatInVibhag = 0;
      markerIndex++;
    }

    if (beatInVibhag === 1) {
      return this.taalStructure.markers[markerIndex] || '';
    }

    return currentBeat.toString();
  }

  // Check if column is a taal marker column
  isTaalMarker(col: number): boolean {
    if (!this.taalStructure || col === 0) return col === 0;

    let markerIndex = 0;
    let beatInVibhag = 0;

    for (let i = 1; i < col; i++) {
      beatInVibhag++;
      if (beatInVibhag >= this.taalStructure.vibhags[markerIndex]) {
        beatInVibhag = 0;
        markerIndex++;
      }
    }

    beatInVibhag++;
    return beatInVibhag === 1;
  }

  // Track by function for ngFor optimization
  trackByIndex(index: number): number {
    return index;
  }
}
