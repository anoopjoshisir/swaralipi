import { Injectable } from '@angular/core';
import { NotationService } from './notation';

@Injectable({
  providedIn: 'root',
})
export class Export {
  constructor(private notationService: NotationService) {}

  /**
   * Export notation grid to PDF
   */
  exportToPDF(): void {
    const grid = this.notationService.getGrid();
    const metadata = this.notationService.getMetadata();
    const taalStructure = this.notationService.getTaalStructure();

    // Create a hidden canvas element
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      alert('Canvas not supported');
      return;
    }

    // Set canvas size (A4 size at 72 DPI)
    const pageWidth = 595; // A4 width in points
    const pageHeight = 842; // A4 height in points
    canvas.width = pageWidth * 2; // Higher resolution
    canvas.height = pageHeight * 2;

    // Scale for better quality
    ctx.scale(2, 2);

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, pageWidth, pageHeight);

    // Draw header
    this.drawHeader(ctx, metadata, pageWidth);

    // Draw grid
    const startY = 120;
    this.drawGrid(ctx, grid, taalStructure, startY, pageWidth);

    // Convert canvas to image
    canvas.toBlob((blob) => {
      if (blob) {
        // For now, download as PNG since we don't have jsPDF
        // In production, you would use jsPDF library
        this.downloadBlob(blob, `${metadata.title || 'composition'}.png`);
        alert('Exported as PNG image. For full PDF support, jsPDF library is needed.');
      }
    });
  }

  /**
   * Export notation grid to PNG image
   */
  exportToPNG(): void {
    const grid = this.notationService.getGrid();
    const metadata = this.notationService.getMetadata();
    const taalStructure = this.notationService.getTaalStructure();

    // Create a canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      alert('Canvas not supported');
      return;
    }

    // Calculate dimensions based on grid size
    const cellWidth = 60;
    const cellHeight = 50;
    const cols = grid[0]?.length || 1;
    const rows = grid.length;
    const padding = 40;
    const headerHeight = 100;

    canvas.width = cols * cellWidth + padding * 2;
    canvas.height = rows * cellHeight + headerHeight + padding * 2;

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw header
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = '#333';
    ctx.textAlign = 'center';
    ctx.fillText(metadata.title || 'Untitled Composition', canvas.width / 2, padding + 30);

    ctx.font = '16px Arial';
    ctx.fillStyle = '#666';
    ctx.fillText(`Raga: ${metadata.raga || 'N/A'} | Taal: ${taalStructure.name} | Tempo: ${metadata.tempo} BPM`,
      canvas.width / 2, padding + 60);

    // Draw grid
    this.drawGridOnCanvas(ctx, grid, taalStructure, padding, headerHeight + padding, cellWidth, cellHeight);

    // Download
    canvas.toBlob((blob) => {
      if (blob) {
        this.downloadBlob(blob, `${metadata.title || 'composition'}.png`);
      }
    });
  }

  /**
   * Export notation grid to SVG
   */
  exportToSVG(): void {
    const grid = this.notationService.getGrid();
    const metadata = this.notationService.getMetadata();
    const taalStructure = this.notationService.getTaalStructure();

    const cellWidth = 60;
    const cellHeight = 50;
    const cols = grid[0]?.length || 1;
    const rows = grid.length;
    const padding = 40;
    const headerHeight = 100;

    const width = cols * cellWidth + padding * 2;
    const height = rows * cellHeight + headerHeight + padding * 2;

    // Create SVG content
    let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="${width}" height="${height}" fill="#ffffff"/>

  <!-- Header -->
  <text x="${width / 2}" y="${padding + 30}" font-family="Arial" font-size="24" font-weight="bold" text-anchor="middle" fill="#333">
    ${this.escapeXml(metadata.title || 'Untitled Composition')}
  </text>
  <text x="${width / 2}" y="${padding + 60}" font-family="Arial" font-size="16" text-anchor="middle" fill="#666">
    Raga: ${this.escapeXml(metadata.raga || 'N/A')} | Taal: ${taalStructure.name} | Tempo: ${metadata.tempo} BPM
  </text>

  <!-- Grid -->`;

    // Draw grid cells
    const startY = headerHeight + padding;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = col * cellWidth + padding;
        const y = row * cellHeight + startY;
        const cell = grid[row][col];

        // Cell background
        const isHeader = col === 0;
        const isTaalMarker = this.isTaalMarkerColumn(col, taalStructure);
        let fillColor = '#ffffff';
        if (isHeader) fillColor = '#f0f0f0';
        else if (isTaalMarker) fillColor = '#f8f9fa';

        svg += `
  <rect x="${x}" y="${y}" width="${cellWidth}" height="${cellHeight}" fill="${fillColor}" stroke="#ddd" stroke-width="1"/>`;

        // Cell content
        if (cell.swar || cell.bol) {
          const centerX = x + cellWidth / 2;
          const centerY = y + cellHeight / 2;

          if (cell.swar) {
            svg += `
  <text x="${centerX}" y="${centerY - 5}" font-family="Arial" font-size="18" text-anchor="middle" fill="#333">
    ${this.escapeXml(cell.swar)}
  </text>`;
          }

          if (cell.bol) {
            svg += `
  <text x="${centerX}" y="${centerY + 18}" font-family="Arial" font-size="14" text-anchor="middle" fill="#666">
    ${this.escapeXml(cell.bol)}
  </text>`;
          }

          // Modifiers
          if (cell.modifiers.includes('lower')) {
            svg += `
  <circle cx="${centerX - 20}" cy="${centerY + 15}" r="3" fill="#667eea"/>`;
          }
          if (cell.modifiers.includes('upper')) {
            svg += `
  <circle cx="${centerX + 20}" cy="${centerY - 15}" r="3" fill="#667eea"/>`;
          }
        }
      }
    }

    svg += '\n</svg>';

    // Download SVG
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    this.downloadBlob(blob, `${metadata.title || 'composition'}.svg`);
  }

  /**
   * Draw header on canvas
   */
  private drawHeader(ctx: CanvasRenderingContext2D, metadata: any, pageWidth: number): void {
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = '#333';
    ctx.textAlign = 'center';
    ctx.fillText(metadata.title || 'Untitled Composition', pageWidth / 2, 40);

    ctx.font = '16px Arial';
    ctx.fillStyle = '#666';
    ctx.fillText(`Raga: ${metadata.raga || 'N/A'} | Taal: ${metadata.taal} | Tempo: ${metadata.tempo} BPM`,
      pageWidth / 2, 70);
  }

  /**
   * Draw grid on canvas
   */
  private drawGrid(ctx: CanvasRenderingContext2D, grid: any[][], taalStructure: any, startY: number, pageWidth: number): void {
    const cellWidth = 50;
    const cellHeight = 40;
    const cols = grid[0]?.length || 1;
    const rows = grid.length;
    const startX = (pageWidth - cols * cellWidth) / 2;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = startX + col * cellWidth;
        const y = startY + row * cellHeight;
        const cell = grid[row][col];

        // Draw cell border
        ctx.strokeStyle = '#ddd';
        ctx.strokeRect(x, y, cellWidth, cellHeight);

        // Draw cell content
        if (cell.swar) {
          ctx.font = '16px Arial';
          ctx.fillStyle = '#333';
          ctx.textAlign = 'center';
          ctx.fillText(cell.swar, x + cellWidth / 2, y + cellHeight / 2);
        }

        if (cell.bol) {
          ctx.font = '12px Arial';
          ctx.fillStyle = '#666';
          ctx.textAlign = 'center';
          ctx.fillText(cell.bol, x + cellWidth / 2, y + cellHeight / 2 + 15);
        }
      }
    }
  }

  /**
   * Draw grid on canvas with full styling
   */
  private drawGridOnCanvas(
    ctx: CanvasRenderingContext2D,
    grid: any[][],
    taalStructure: any,
    startX: number,
    startY: number,
    cellWidth: number,
    cellHeight: number
  ): void {
    const rows = grid.length;
    const cols = grid[0]?.length || 1;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = startX + col * cellWidth;
        const y = startY + row * cellHeight;
        const cell = grid[row][col];

        // Cell background
        const isHeader = col === 0;
        const isTaalMarker = this.isTaalMarkerColumn(col, taalStructure);

        if (isHeader) {
          ctx.fillStyle = '#f0f0f0';
          ctx.fillRect(x, y, cellWidth, cellHeight);
        } else if (isTaalMarker) {
          ctx.fillStyle = '#f8f9fa';
          ctx.fillRect(x, y, cellWidth, cellHeight);
        }

        // Cell border
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, cellWidth, cellHeight);

        // Cell content
        const centerX = x + cellWidth / 2;
        const centerY = y + cellHeight / 2;

        if (cell.swar) {
          ctx.font = '18px Arial';
          ctx.fillStyle = '#333';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(cell.swar, centerX, centerY - 5);
        }

        if (cell.bol) {
          ctx.font = '14px Arial';
          ctx.fillStyle = '#666';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(cell.bol, centerX, centerY + 15);
        }

        // Draw modifiers
        if (cell.modifiers.includes('lower')) {
          ctx.fillStyle = '#667eea';
          ctx.beginPath();
          ctx.arc(centerX - 20, centerY + 15, 3, 0, 2 * Math.PI);
          ctx.fill();
        }
        if (cell.modifiers.includes('upper')) {
          ctx.fillStyle = '#667eea';
          ctx.beginPath();
          ctx.arc(centerX + 20, centerY - 15, 3, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
    }
  }

  /**
   * Check if column is a taal marker
   */
  private isTaalMarkerColumn(col: number, taalStructure: any): boolean {
    if (col === 0) return true;

    let beatIndex = 1;
    let vibhagIndex = 0;
    let beatInVibhag = 0;

    while (beatIndex < col && vibhagIndex < taalStructure.vibhags.length) {
      beatInVibhag++;
      if (beatInVibhag >= taalStructure.vibhags[vibhagIndex]) {
        beatInVibhag = 0;
        vibhagIndex++;
      }
      beatIndex++;
    }

    return beatInVibhag === 0;
  }

  /**
   * Download blob as file
   */
  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
