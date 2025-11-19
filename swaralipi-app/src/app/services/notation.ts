import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  NotationCell,
  NotationGrid,
  CellPosition,
  TaalStructure,
  TAAL_STRUCTURES,
  CompositionMetadata,
  Modifier,
  SWAR_MAP,
  BOL_MAP
} from '../models/notation.model';

@Injectable({
  providedIn: 'root'
})
export class NotationService {
  private readonly DEFAULT_ROWS = 10;
  private grid: NotationCell[][] = [];
  private rows = this.DEFAULT_ROWS;
  private currentTaal: string = 'teen';

  // Observables for reactive updates
  private gridSubject = new BehaviorSubject<NotationCell[][]>([]);
  private selectedCellSubject = new BehaviorSubject<CellPosition>({ row: 0, col: 1 });
  private metadataSubject = new BehaviorSubject<CompositionMetadata>({
    raga: '',
    taal: 'teen',
    tempo: 120
  });

  // History for undo/redo
  private history: NotationCell[][][] = [];
  private historyIndex = -1;
  private readonly MAX_HISTORY = 50;

  public grid$ = this.gridSubject.asObservable();
  public selectedCell$ = this.selectedCellSubject.asObservable();
  public metadata$ = this.metadataSubject.asObservable();

  constructor() {
    this.initializeGrid();
  }

  private initializeGrid(): void {
    const taal = this.getTaalStructure();
    const cols = taal.beats + 1; // +1 for row header

    this.grid = [];
    for (let i = 0; i < this.rows; i++) {
      const row: NotationCell[] = [];
      for (let j = 0; j < cols; j++) {
        row.push({
          swar: '',
          bol: '',
          modifiers: [],
          isHeader: j === 0
        });
      }
      this.grid.push(row);
    }

    this.gridSubject.next(this.grid);
  }

  getTaalStructure(): TaalStructure {
    return TAAL_STRUCTURES[this.currentTaal] || TAAL_STRUCTURES['teen'];
  }

  changeTaal(taalName: string): void {
    if (TAAL_STRUCTURES[taalName]) {
      this.currentTaal = taalName;
      const metadata = this.metadataSubject.value;
      metadata.taal = taalName;
      this.metadataSubject.next(metadata);
      this.initializeGrid();
    }
  }

  getGrid(): NotationCell[][] {
    return this.grid;
  }

  getCell(row: number, col: number): NotationCell | null {
    if (row >= 0 && row < this.rows && col >= 0 && col < this.grid[row].length) {
      return this.grid[row][col];
    }
    return null;
  }

  selectCell(position: CellPosition): void {
    if (position.col > 0) { // Don't allow selecting header cells
      this.selectedCellSubject.next(position);
    }
  }

  getSelectedCell(): CellPosition {
    return this.selectedCellSubject.value;
  }

  setCellSwar(row: number, col: number, swar: string): void {
    const cell = this.getCell(row, col);
    if (cell && col > 0) {
      this.saveState();

      // Map input to proper swar notation
      const mappedSwar = SWAR_MAP[swar] || swar;
      cell.swar = mappedSwar;

      this.gridSubject.next(this.grid);
    }
  }

  setCellBol(row: number, col: number, bol: string): void {
    const cell = this.getCell(row, col);
    if (cell && col > 0) {
      this.saveState();

      // Map input to proper bol notation
      const mappedBol = BOL_MAP[bol] || bol;
      cell.bol = mappedBol;

      this.gridSubject.next(this.grid);
    }
  }

  toggleModifier(row: number, col: number, modifier: Modifier): void {
    const cell = this.getCell(row, col);
    if (cell && col > 0) {
      this.saveState();

      const index = cell.modifiers.indexOf(modifier);
      if (index >= 0) {
        cell.modifiers.splice(index, 1);
      } else {
        // Some modifiers are mutually exclusive
        if (modifier === 'lower' || modifier === 'upper') {
          cell.modifiers = cell.modifiers.filter(m => m !== 'lower' && m !== 'upper');
        }
        cell.modifiers.push(modifier);
      }

      this.gridSubject.next(this.grid);
    }
  }

  clearCell(row: number, col: number): void {
    const cell = this.getCell(row, col);
    if (cell && col > 0) {
      this.saveState();

      cell.swar = '';
      cell.bol = '';
      cell.modifiers = [];

      this.gridSubject.next(this.grid);
    }
  }

  insertRow(afterRow: number): void {
    this.saveState();

    const taal = this.getTaalStructure();
    const cols = taal.beats + 1;
    const newRow: NotationCell[] = [];

    for (let j = 0; j < cols; j++) {
      newRow.push({
        swar: '',
        bol: '',
        modifiers: [],
        isHeader: j === 0
      });
    }

    this.grid.splice(afterRow + 1, 0, newRow);
    this.rows++;

    this.gridSubject.next(this.grid);
  }

  deleteRow(row: number): void {
    if (this.rows > 1) {
      this.saveState();

      this.grid.splice(row, 1);
      this.rows--;

      // Adjust selected cell if needed
      const selected = this.selectedCellSubject.value;
      if (selected.row >= this.rows) {
        this.selectedCellSubject.next({ ...selected, row: this.rows - 1 });
      }

      this.gridSubject.next(this.grid);
    }
  }

  moveSelection(direction: 'up' | 'down' | 'left' | 'right'): void {
    const current = this.selectedCellSubject.value;
    const maxCol = this.grid[0].length - 1;
    let newPos = { ...current };

    switch (direction) {
      case 'up':
        newPos.row = Math.max(0, current.row - 1);
        break;
      case 'down':
        newPos.row = Math.min(this.rows - 1, current.row + 1);
        break;
      case 'left':
        newPos.col = Math.max(1, current.col - 1);
        break;
      case 'right':
        newPos.col = Math.min(maxCol, current.col + 1);
        break;
    }

    this.selectedCellSubject.next(newPos);
  }

  private saveState(): void {
    // Remove any states after current index
    this.history = this.history.slice(0, this.historyIndex + 1);

    // Add current state (deep copy)
    this.history.push(JSON.parse(JSON.stringify(this.grid)));

    // Limit history size
    if (this.history.length > this.MAX_HISTORY) {
      this.history.shift();
    } else {
      this.historyIndex++;
    }
  }

  undo(): boolean {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.grid = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
      this.gridSubject.next(this.grid);
      return true;
    }
    return false;
  }

  redo(): boolean {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.grid = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
      this.gridSubject.next(this.grid);
      return true;
    }
    return false;
  }

  clearGrid(): void {
    this.saveState();
    this.initializeGrid();
  }

  updateMetadata(metadata: Partial<CompositionMetadata>): void {
    const current = this.metadataSubject.value;
    this.metadataSubject.next({ ...current, ...metadata });

    if (metadata.taal && metadata.taal !== this.currentTaal) {
      this.changeTaal(metadata.taal);
    }
  }

  getMetadata(): CompositionMetadata {
    return this.metadataSubject.value;
  }

  exportToJSON(): string {
    const data: NotationGrid = {
      rows: this.rows,
      cols: this.grid[0].length,
      cells: this.grid,
      metadata: this.metadataSubject.value
    };
    return JSON.stringify(data, null, 2);
  }

  importFromJSON(jsonString: string): boolean {
    try {
      const data: NotationGrid = JSON.parse(jsonString);

      if (data.cells && Array.isArray(data.cells)) {
        this.saveState();
        this.grid = data.cells;
        this.rows = data.rows || data.cells.length;

        if (data.metadata) {
          this.metadataSubject.next(data.metadata);
          if (data.metadata.taal) {
            this.currentTaal = data.metadata.taal;
          }
        }

        this.gridSubject.next(this.grid);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error importing JSON:', error);
      return false;
    }
  }

  getRowCount(): number {
    return this.rows;
  }

  getColCount(): number {
    return this.grid[0]?.length || 0;
  }
}
