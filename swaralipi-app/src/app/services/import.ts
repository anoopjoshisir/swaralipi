import { Injectable } from '@angular/core';
import { ImportResult, NotationGrid, NotationCell, NotationLayer, CompositionLyrics, CompositionMetadata } from '../models/notation.model';

@Injectable({
  providedIn: 'root'
})
export class ImportService {

  constructor() {}

  // Import from JSON format
  importFromJSON(jsonString: string): ImportResult {
    try {
      const data = JSON.parse(jsonString);

      // Check if it's a multi-layer format
      if (data.layers && Array.isArray(data.layers)) {
        return {
          success: true,
          layers: data.layers,
          lyrics: data.lyrics,
          grid: this.convertLayersToGrid(data.layers[0])
        };
      }

      // Single layer format
      if (data.cells && Array.isArray(data.cells)) {
        return {
          success: true,
          grid: data as NotationGrid,
          lyrics: data.lyrics
        };
      }

      return {
        success: false,
        error: 'Invalid JSON format'
      };
    } catch (error) {
      return {
        success: false,
        error: `JSON parse error: ${error}`
      };
    }
  }

  // Import from XML/MusicXML format
  importFromXML(xmlString: string): ImportResult {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

      // Check for parse errors
      if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
        return {
          success: false,
          error: 'XML parse error'
        };
      }

      // Extract composition data
      const grid = this.parseXMLToGrid(xmlDoc);
      const metadata = this.parseXMLMetadata(xmlDoc);
      const lyrics = this.parseXMLLyrics(xmlDoc);

      return {
        success: true,
        grid: {
          rows: grid.length,
          cols: grid[0]?.length || 0,
          cells: grid,
          metadata
        },
        lyrics
      };
    } catch (error) {
      return {
        success: false,
        error: `XML import error: ${error}`
      };
    }
  }

  private parseXMLToGrid(xmlDoc: Document): NotationCell[][] {
    const grid: NotationCell[][] = [];
    const rows = xmlDoc.getElementsByTagName('row');

    for (let i = 0; i < rows.length; i++) {
      const row: NotationCell[] = [];
      const cells = rows[i].getElementsByTagName('cell');

      for (let j = 0; j < cells.length; j++) {
        const cell = cells[j];
        row.push({
          swar: cell.getAttribute('swar') || '',
          bol: cell.getAttribute('bol') || '',
          modifiers: (cell.getAttribute('modifiers') || '').split(',').filter(m => m) as any[],
          isHeader: cell.getAttribute('isHeader') === 'true'
        });
      }
      grid.push(row);
    }

    return grid;
  }

  private parseXMLMetadata(xmlDoc: Document): CompositionMetadata {
    const metadataNode = xmlDoc.getElementsByTagName('metadata')[0];
    if (!metadataNode) {
      return {
        raga: '',
        taal: 'teen',
        tempo: 120
      };
    }

    return {
      raga: metadataNode.getElementsByTagName('raga')[0]?.textContent || '',
      taal: metadataNode.getElementsByTagName('taal')[0]?.textContent || 'teen',
      tempo: parseInt(metadataNode.getElementsByTagName('tempo')[0]?.textContent || '120'),
      title: metadataNode.getElementsByTagName('title')[0]?.textContent || undefined,
      artist: metadataNode.getElementsByTagName('artist')[0]?.textContent || undefined
    };
  }

  private parseXMLLyrics(xmlDoc: Document): CompositionLyrics | undefined {
    const lyricsNode = xmlDoc.getElementsByTagName('lyrics')[0];
    if (!lyricsNode) {
      return undefined;
    }

    const lines = lyricsNode.getElementsByTagName('line');
    const lyricsLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      lyricsLines.push({
        rowIndex: parseInt(line.getAttribute('rowIndex') || '0'),
        lyrics: (line.textContent || '').split('|'),
        language: line.getAttribute('language') as any
      });
    }

    return {
      lines: lyricsLines,
      showLyrics: lyricsNode.getAttribute('show') !== 'false'
    };
  }

  // Import from CSV format
  importFromCSV(csvString: string): ImportResult {
    try {
      const lines = csvString.split('\n').filter(l => l.trim());
      if (lines.length === 0) {
        return {
          success: false,
          error: 'Empty CSV file'
        };
      }

      const grid: NotationCell[][] = [];

      lines.forEach((line, rowIndex) => {
        const values = this.parseCSVLine(line);
        const row: NotationCell[] = [];

        values.forEach((value, colIndex) => {
          const parts = value.split('/'); // Format: swar/bol/modifiers
          row.push({
            swar: parts[0] || '',
            bol: parts[1] || '',
            modifiers: parts[2] ? parts[2].split(',') as any[] : [],
            isHeader: colIndex === 0
          });
        });

        grid.push(row);
      });

      return {
        success: true,
        grid: {
          rows: grid.length,
          cols: grid[0]?.length || 0,
          cells: grid,
          metadata: {
            raga: '',
            taal: 'teen',
            tempo: 120
          }
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `CSV import error: ${error}`
      };
    }
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  // Import from plain text format (custom swaralipi text format)
  importFromText(text: string): ImportResult {
    try {
      const lines = text.split('\n').filter(l => l.trim());
      const grid: NotationCell[][] = [];
      let metadata: CompositionMetadata = {
        raga: '',
        taal: 'teen',
        tempo: 120
      };

      lines.forEach((line, index) => {
        // Check for metadata lines
        if (line.startsWith('RAGA:')) {
          metadata.raga = line.substring(5).trim();
          return;
        }
        if (line.startsWith('TAAL:')) {
          metadata.taal = line.substring(5).trim().toLowerCase();
          return;
        }
        if (line.startsWith('TEMPO:')) {
          metadata.tempo = parseInt(line.substring(6).trim());
          return;
        }
        if (line.startsWith('TITLE:')) {
          metadata.title = line.substring(6).trim();
          return;
        }

        // Parse notation line
        const cells = line.split('|').map(cell => cell.trim());
        const row: NotationCell[] = [];

        cells.forEach((cellText, colIndex) => {
          const cell = this.parseTextCell(cellText);
          cell.isHeader = colIndex === 0;
          row.push(cell);
        });

        grid.push(row);
      });

      return {
        success: true,
        grid: {
          rows: grid.length,
          cols: grid[0]?.length || 0,
          cells: grid,
          metadata
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Text import error: ${error}`
      };
    }
  }

  private parseTextCell(cellText: string): NotationCell {
    const cell: NotationCell = {
      swar: '',
      bol: '',
      modifiers: [],
      isHeader: false
    };

    // Format: "सा[lower,meend] धा"
    const match = cellText.match(/^([^\[]*)\[([^\]]*)\]\s*(.*)$/);
    if (match) {
      cell.swar = match[1].trim();
      cell.modifiers = match[2].split(',').map(m => m.trim()) as any[];
      cell.bol = match[3].trim();
    } else {
      // Simple format: "सा धा" or just "सा"
      const parts = cellText.split(/\s+/);
      if (parts.length > 0) {
        // Check if first part looks like a bol (contains only bol characters)
        if (parts[0].match(/^[धतकगनदटडपबम]+$/)) {
          cell.bol = parts[0];
          cell.swar = parts[1] || '';
        } else {
          cell.swar = parts[0];
          cell.bol = parts[1] || '';
        }
      }
    }

    return cell;
  }

  // Helper to convert layer to grid format
  private convertLayersToGrid(layer: NotationLayer): NotationGrid {
    return {
      rows: layer.cells.length,
      cols: layer.cells[0]?.length || 0,
      cells: layer.cells,
      metadata: {
        raga: '',
        taal: 'teen',
        tempo: 120
      }
    };
  }

  // Auto-detect format and import
  autoDetectAndImport(content: string): ImportResult {
    // Try JSON first
    if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
      const result = this.importFromJSON(content);
      if (result.success) {
        return result;
      }
    }

    // Try XML
    if (content.trim().startsWith('<')) {
      const result = this.importFromXML(content);
      if (result.success) {
        return result;
      }
    }

    // Try CSV (look for commas)
    if (content.includes(',') && !content.includes('<') && !content.includes('{')) {
      const result = this.importFromCSV(content);
      if (result.success) {
        return result;
      }
    }

    // Default to text format
    return this.importFromText(content);
  }
}
