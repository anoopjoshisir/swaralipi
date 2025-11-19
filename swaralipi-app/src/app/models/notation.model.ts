// Notation Models and Interfaces

export interface NotationCell {
  swar: string;         // Musical note (सा, रे, ग, etc.)
  bol: string;          // Tabla bol (धा, ति, etc.)
  modifiers: Modifier[];
  isHeader: boolean;
}

export type Modifier = 'lower' | 'upper' | 'meend' | 'kan';

export interface TaalStructure {
  beats: number;
  vibhags: number[];    // Divisions of the taal
  markers: string[];    // X, 0, 2, 3, etc.
  name: string;
}

export interface CompositionMetadata {
  raga: string;
  taal: string;
  tempo: number;        // BPM
  title?: string;
  artist?: string;
  date?: Date;
}

export interface NotationGrid {
  rows: number;
  cols: number;
  cells: NotationCell[][];
  metadata: CompositionMetadata;
}

export interface CellPosition {
  row: number;
  col: number;
}

export interface PlaybackState {
  isPlaying: boolean;
  currentBeat: number;
  currentCycle: number;
  currentRow: number;
  currentCol: number;
}

// Swar (Note) mappings
export const SWAR_MAP: { [key: string]: string } = {
  's': 'सा',
  'r': 'रे',
  'R': 'रे',  // Komal Re
  'g': 'ग',
  'G': 'ग',  // Teevra Ga
  'm': 'म',
  'M': 'म',  // Teevra Ma
  'p': 'प',
  'd': 'ध',
  'D': 'ध',  // Komal Dha
  'n': 'नी',
  'N': 'नी', // Komal Ni
  'सा': 'सा',
  'रे': 'रे',
  'रे॒': 'रे॒',
  'ग': 'ग',
  'ग॒': 'ग॒',
  'म': 'म',
  'म॑': 'म॑',
  'प': 'प',
  'ध': 'ध',
  'ध॒': 'ध॒',
  'नी': 'नी',
  'नी॒': 'नी॒'
};

// Tabla bol mappings
export const BOL_MAP: { [key: string]: string } = {
  'धा': 'धा',
  'धिं': 'धिं',
  'धिर': 'धिर',
  'धिन': 'धिन',
  'ता': 'ता',
  'ति': 'ति',
  'तिं': 'तिं',
  'तिरकिट': 'तिरकिट',
  'का': 'का',
  'गे': 'गे',
  'ना': 'ना',
  'दिन': 'दिन',
  'S': 'S',
  '-': '-',
  'x': 'x'
};

// Predefined Taal structures
export const TAAL_STRUCTURES: { [key: string]: TaalStructure } = {
  teen: {
    name: 'तीनताल',
    beats: 16,
    vibhags: [4, 4, 4, 4],
    markers: ['X', '2', '0', '3']
  },
  ektaal: {
    name: 'एकताल',
    beats: 12,
    vibhags: [2, 2, 2, 2, 2, 2],
    markers: ['X', '0', '2', '0', '3', '4']
  },
  jhaptaal: {
    name: 'झपताल',
    beats: 10,
    vibhags: [2, 3, 2, 3],
    markers: ['X', '2', '0', '3']
  },
  rupak: {
    name: 'रूपक',
    beats: 7,
    vibhags: [3, 2, 2],
    markers: ['X', '2', '3']
  },
  dadra: {
    name: 'दादरा',
    beats: 6,
    vibhags: [3, 3],
    markers: ['X', '0']
  },
  keherwa: {
    name: 'कहरवा',
    beats: 8,
    vibhags: [4, 4],
    markers: ['X', '0']
  }
};

// Swar to frequency mapping (in Hz, for Sa = C4 = 261.63 Hz)
export const SWAR_FREQUENCIES: { [key: string]: number } = {
  'सा': 261.63,    // C4 (Sa)
  'रे॒': 277.18,   // C#4 (Komal Re)
  'रे': 293.66,    // D4 (Re)
  'ग॒': 311.13,    // D#4 (Komal Ga)
  'ग': 329.63,     // E4 (Ga)
  'म': 349.23,     // F4 (Ma)
  'म॑': 369.99,    // F#4 (Teevra Ma)
  'प': 392.00,     // G4 (Pa)
  'ध॒': 415.30,    // G#4 (Komal Dha)
  'ध': 440.00,     // A4 (Dha)
  'नी॒': 466.16,   // A#4 (Komal Ni)
  'नी': 493.88     // B4 (Ni)
};

// Export options
export interface ExportOptions {
  format: 'pdf' | 'png' | 'json' | 'svg';
  title?: string;
  includeMetadata?: boolean;
  pageSize?: 'a4' | 'letter' | 'a3';
  orientation?: 'portrait' | 'landscape';
}
