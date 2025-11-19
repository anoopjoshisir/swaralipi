import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { SelectionRange, NotationCell, CellPosition } from '../models/notation.model';

@Injectable({
  providedIn: 'root'
})
export class EditingService {
  private clipboard: NotationCell[][] = [];
  private selectionRange: SelectionRange | null = null;
  private isSelecting = false;

  private selectionSubject = new BehaviorSubject<SelectionRange | null>(null);
  public selection$ = this.selectionSubject.asObservable();

  constructor() {}

  // Selection management
  startSelection(row: number, col: number): void {
    this.isSelecting = true;
    this.selectionRange = {
      startRow: row,
      startCol: col,
      endRow: row,
      endCol: col
    };
    this.selectionSubject.next(this.selectionRange);
  }

  updateSelection(row: number, col: number): void {
    if (this.isSelecting && this.selectionRange) {
      this.selectionRange.endRow = row;
      this.selectionRange.endCol = col;
      this.selectionSubject.next(this.selectionRange);
    }
  }

  endSelection(): void {
    this.isSelecting = false;
  }

  clearSelection(): void {
    this.selectionRange = null;
    this.isSelecting = false;
    this.selectionSubject.next(null);
  }

  getSelection(): SelectionRange | null {
    return this.selectionRange ? { ...this.selectionRange } : null;
  }

  hasSelection(): boolean {
    return this.selectionRange !== null;
  }

  // Get normalized selection (ensure start is before end)
  getNormalizedSelection(): SelectionRange | null {
    if (!this.selectionRange) return null;

    return {
      startRow: Math.min(this.selectionRange.startRow, this.selectionRange.endRow),
      startCol: Math.min(this.selectionRange.startCol, this.selectionRange.endCol),
      endRow: Math.max(this.selectionRange.startRow, this.selectionRange.endRow),
      endCol: Math.max(this.selectionRange.startCol, this.selectionRange.endCol)
    };
  }

  isCellInSelection(row: number, col: number): boolean {
    const selection = this.getNormalizedSelection();
    if (!selection) return false;

    return row >= selection.startRow && row <= selection.endRow &&
           col >= selection.startCol && col <= selection.endCol;
  }

  // Copy operation
  copy(grid: NotationCell[][]): boolean {
    const selection = this.getNormalizedSelection();
    if (!selection) return false;

    this.clipboard = [];

    for (let row = selection.startRow; row <= selection.endRow; row++) {
      const clipboardRow: NotationCell[] = [];
      for (let col = selection.startCol; col <= selection.endCol; col++) {
        if (grid[row] && grid[row][col]) {
          // Deep copy the cell
          clipboardRow.push(JSON.parse(JSON.stringify(grid[row][col])));
        }
      }
      this.clipboard.push(clipboardRow);
    }

    return true;
  }

  // Cut operation
  cut(grid: NotationCell[][]): boolean {
    if (!this.copy(grid)) return false;

    const selection = this.getNormalizedSelection();
    if (!selection) return false;

    // Clear the selected cells
    for (let row = selection.startRow; row <= selection.endRow; row++) {
      for (let col = selection.startCol; col <= selection.endCol; col++) {
        if (grid[row] && grid[row][col] && col > 0) { // Don't cut header cells
          grid[row][col].swar = '';
          grid[row][col].bol = '';
          grid[row][col].modifiers = [];
        }
      }
    }

    return true;
  }

  // Paste operation
  paste(grid: NotationCell[][], startRow: number, startCol: number): boolean {
    if (this.clipboard.length === 0) return false;

    const maxRow = grid.length;
    const maxCol = grid[0]?.length || 0;

    for (let i = 0; i < this.clipboard.length; i++) {
      const targetRow = startRow + i;
      if (targetRow >= maxRow) break;

      for (let j = 0; j < this.clipboard[i].length; j++) {
        const targetCol = startCol + j;
        if (targetCol >= maxCol || targetCol === 0) continue; // Skip header column

        if (grid[targetRow] && grid[targetRow][targetCol]) {
          const sourceCell = this.clipboard[i][j];
          const targetCell = grid[targetRow][targetCol];

          targetCell.swar = sourceCell.swar;
          targetCell.bol = sourceCell.bol;
          targetCell.modifiers = [...sourceCell.modifiers];
        }
      }
    }

    return true;
  }

  hasClipboardData(): boolean {
    return this.clipboard.length > 0;
  }

  getClipboardSize(): { rows: number; cols: number } {
    return {
      rows: this.clipboard.length,
      cols: this.clipboard[0]?.length || 0
    };
  }

  // Select all
  selectAll(maxRow: number, maxCol: number): void {
    this.selectionRange = {
      startRow: 0,
      startCol: 1, // Skip header column
      endRow: maxRow - 1,
      endCol: maxCol - 1
    };
    this.selectionSubject.next(this.selectionRange);
  }

  // Select row
  selectRow(row: number, maxCol: number): void {
    this.selectionRange = {
      startRow: row,
      startCol: 1, // Skip header column
      endRow: row,
      endCol: maxCol - 1
    };
    this.selectionSubject.next(this.selectionRange);
  }

  // Select column
  selectColumn(col: number, maxRow: number): void {
    if (col === 0) return; // Don't select header column

    this.selectionRange = {
      startRow: 0,
      startCol: col,
      endRow: maxRow - 1,
      endCol: col
    };
    this.selectionSubject.next(this.selectionRange);
  }

  // Extend selection with keyboard
  extendSelectionUp(): void {
    if (!this.selectionRange) return;
    this.selectionRange.endRow = Math.max(0, this.selectionRange.endRow - 1);
    this.selectionSubject.next(this.selectionRange);
  }

  extendSelectionDown(maxRow: number): void {
    if (!this.selectionRange) return;
    this.selectionRange.endRow = Math.min(maxRow - 1, this.selectionRange.endRow + 1);
    this.selectionSubject.next(this.selectionRange);
  }

  extendSelectionLeft(): void {
    if (!this.selectionRange) return;
    this.selectionRange.endCol = Math.max(1, this.selectionRange.endCol - 1);
    this.selectionSubject.next(this.selectionRange);
  }

  extendSelectionRight(maxCol: number): void {
    if (!this.selectionRange) return;
    this.selectionRange.endCol = Math.min(maxCol - 1, this.selectionRange.endCol + 1);
    this.selectionSubject.next(this.selectionRange);
  }

  // Fill operation (like Excel's drag-fill)
  fill(grid: NotationCell[][], direction: 'down' | 'right'): boolean {
    const selection = this.getNormalizedSelection();
    if (!selection) return false;

    const maxRow = grid.length;
    const maxCol = grid[0]?.length || 0;

    if (direction === 'down') {
      // Copy first row of selection down
      const sourceRow = selection.startRow;
      for (let row = selection.startRow + 1; row <= selection.endRow; row++) {
        for (let col = selection.startCol; col <= selection.endCol; col++) {
          if (grid[row] && grid[row][col] && grid[sourceRow] && grid[sourceRow][col]) {
            const sourceCell = grid[sourceRow][col];
            const targetCell = grid[row][col];

            targetCell.swar = sourceCell.swar;
            targetCell.bol = sourceCell.bol;
            targetCell.modifiers = [...sourceCell.modifiers];
          }
        }
      }
      return true;
    }

    if (direction === 'right') {
      // Copy first column of selection right
      const sourceCol = selection.startCol;
      for (let row = selection.startRow; row <= selection.endRow; row++) {
        for (let col = selection.startCol + 1; col <= selection.endCol; col++) {
          if (grid[row] && grid[row][col] && grid[row][sourceCol]) {
            const sourceCell = grid[row][sourceCol];
            const targetCell = grid[row][col];

            targetCell.swar = sourceCell.swar;
            targetCell.bol = sourceCell.bol;
            targetCell.modifiers = [...sourceCell.modifiers];
          }
        }
      }
      return true;
    }

    return false;
  }

  // Find and replace
  findCells(grid: NotationCell[][], searchText: string, searchIn: 'swar' | 'bol' | 'both'): CellPosition[] {
    const results: CellPosition[] = [];
    const lowerSearch = searchText.toLowerCase();

    for (let row = 0; row < grid.length; row++) {
      for (let col = 1; col < grid[row].length; col++) { // Skip header column
        const cell = grid[row][col];
        let match = false;

        if (searchIn === 'swar' || searchIn === 'both') {
          if (cell.swar.toLowerCase().includes(lowerSearch)) {
            match = true;
          }
        }

        if (searchIn === 'bol' || searchIn === 'both') {
          if (cell.bol.toLowerCase().includes(lowerSearch)) {
            match = true;
          }
        }

        if (match) {
          results.push({ row, col });
        }
      }
    }

    return results;
  }

  replaceCells(
    grid: NotationCell[][],
    searchText: string,
    replaceText: string,
    replaceIn: 'swar' | 'bol' | 'both'
  ): number {
    let count = 0;

    for (let row = 0; row < grid.length; row++) {
      for (let col = 1; col < grid[row].length; col++) {
        const cell = grid[row][col];

        if (replaceIn === 'swar' || replaceIn === 'both') {
          if (cell.swar === searchText) {
            cell.swar = replaceText;
            count++;
          }
        }

        if (replaceIn === 'bol' || replaceIn === 'both') {
          if (cell.bol === searchText) {
            cell.bol = replaceText;
            count++;
          }
        }
      }
    }

    return count;
  }

  // Transpose selection (shift notes up/down)
  transposeSelection(grid: NotationCell[][], semitones: number): boolean {
    const selection = this.getNormalizedSelection();
    if (!selection) return false;

    // Note: This would require a more sophisticated implementation
    // with proper swar mapping for transposition
    // For now, this is a placeholder

    return true;
  }
}
