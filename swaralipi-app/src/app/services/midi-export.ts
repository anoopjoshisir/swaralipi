import { Injectable } from '@angular/core';
import { NotationCell, NotationGrid, TaalStructure, SWAR_FREQUENCIES, NotationLayer } from '../models/notation.model';

export interface MIDITrack {
  name: string;
  channel: number;
  instrument: number; // MIDI program number
  events: MIDIEvent[];
}

export interface MIDIEvent {
  type: 'noteOn' | 'noteOff' | 'tempo' | 'timeSignature';
  time: number; // in ticks
  note?: number; // MIDI note number (0-127)
  velocity?: number; // 0-127
  duration?: number; // in ticks
  tempo?: number; // BPM
  numerator?: number; // Time signature
  denominator?: number;
}

export interface MIDIExportOptions {
  includeTabla: boolean;
  includeTanpura: boolean;
  tempo: number;
  ticksPerBeat: number;
  velocity: number; // Default velocity
  swarChannel: number;
  tablaChannel: number;
  tanpuraChannel: number;
}

@Injectable({
  providedIn: 'root'
})
export class MIDIExportService {

  private readonly MIDI_HEADER = 'MThd';
  private readonly TRACK_HEADER = 'MTrk';
  private readonly TICKS_PER_QUARTER_NOTE = 480;

  constructor() {}

  exportToMIDI(
    grid: NotationGrid,
    options?: Partial<MIDIExportOptions>
  ): Blob {
    const opts: MIDIExportOptions = {
      includeTabla: true,
      includeTanpura: false,
      tempo: grid.metadata.tempo || 120,
      ticksPerBeat: this.TICKS_PER_QUARTER_NOTE,
      velocity: 80,
      swarChannel: 0,
      tablaChannel: 9, // MIDI channel 10 (drums)
      tanpuraChannel: 1,
      ...options
    };

    const tracks: MIDITrack[] = [];

    // Create swar track
    const swarTrack = this.createSwarTrack(grid, opts);
    tracks.push(swarTrack);

    // Create tabla track if enabled
    if (opts.includeTabla) {
      const tablaTrack = this.createTablaTrack(grid, opts);
      tracks.push(tablaTrack);
    }

    // Create tanpura track if enabled
    if (opts.includeTanpura) {
      const tanpuraTrack = this.createTanpuraTrack(grid, opts);
      tracks.push(tanpuraTrack);
    }

    // Build MIDI file
    const midiData = this.buildMIDIFile(tracks, opts);

    return new Blob([midiData as any], { type: 'audio/midi' });
  }

  exportLayersToMIDI(
    layers: NotationLayer[],
    grid: NotationGrid,
    options?: Partial<MIDIExportOptions>
  ): Blob {
    const opts: MIDIExportOptions = {
      includeTabla: true,
      includeTanpura: false,
      tempo: grid.metadata.tempo || 120,
      ticksPerBeat: this.TICKS_PER_QUARTER_NOTE,
      velocity: 80,
      swarChannel: 0,
      tablaChannel: 9,
      tanpuraChannel: 1,
      ...options
    };

    const tracks: MIDITrack[] = [];

    layers.forEach((layer, index) => {
      const track = this.createLayerTrack(layer, index, opts);
      tracks.push(track);
    });

    const midiData = this.buildMIDIFile(tracks, opts);

    return new Blob([midiData as any], { type: 'audio/midi' });
  }

  private createSwarTrack(grid: NotationGrid, options: MIDIExportOptions): MIDITrack {
    const track: MIDITrack = {
      name: 'Swar (Vocal)',
      channel: options.swarChannel,
      instrument: 75, // Pan Flute (or use 73 for Flute for vocal-like sound)
      events: []
    };

    let currentTick = 0;

    for (let row = 0; row < grid.cells.length; row++) {
      for (let col = 1; col < grid.cells[row].length; col++) {
        const cell = grid.cells[row][col];

        if (cell.swar && cell.swar !== '-' && cell.swar !== ',') {
          const midiNote = this.swarToMIDINote(cell.swar, cell.modifiers);

          if (midiNote !== null) {
            track.events.push({
              type: 'noteOn',
              time: currentTick,
              note: midiNote,
              velocity: options.velocity,
              duration: options.ticksPerBeat
            });

            track.events.push({
              type: 'noteOff',
              time: currentTick + options.ticksPerBeat,
              note: midiNote,
              velocity: 0
            });
          }
        }

        currentTick += options.ticksPerBeat;
      }
    }

    return track;
  }

  private createTablaTrack(grid: NotationGrid, options: MIDIExportOptions): MIDITrack {
    const track: MIDITrack = {
      name: 'Tabla',
      channel: options.tablaChannel,
      instrument: 0, // Acoustic Grand Piano (drums use channel 10, instrument doesn't matter)
      events: []
    };

    let currentTick = 0;

    for (let row = 0; row < grid.cells.length; row++) {
      for (let col = 1; col < grid.cells[row].length; col++) {
        const cell = grid.cells[row][col];

        if (cell.bol && cell.bol !== '-' && cell.bol !== 'x') {
          const midiNote = this.bolToMIDINote(cell.bol);

          if (midiNote !== null) {
            track.events.push({
              type: 'noteOn',
              time: currentTick,
              note: midiNote,
              velocity: options.velocity,
              duration: options.ticksPerBeat / 2
            });

            track.events.push({
              type: 'noteOff',
              time: currentTick + options.ticksPerBeat / 2,
              note: midiNote,
              velocity: 0
            });
          }
        }

        currentTick += options.ticksPerBeat;
      }
    }

    return track;
  }

  private createTanpuraTrack(grid: NotationGrid, options: MIDIExportOptions): MIDITrack {
    const track: MIDITrack = {
      name: 'Tanpura Drone',
      channel: options.tanpuraChannel,
      instrument: 109, // Shanai (Indian instrument sound)
      events: []
    };

    // Play Sa (C) as a continuous drone
    const saNote = 60; // Middle C
    const totalTicks = grid.cells.length * (grid.cells[0].length - 1) * options.ticksPerBeat;

    track.events.push({
      type: 'noteOn',
      time: 0,
      note: saNote,
      velocity: 40, // Quieter for background
      duration: totalTicks
    });

    track.events.push({
      type: 'noteOff',
      time: totalTicks,
      note: saNote,
      velocity: 0
    });

    // Add Pa (G) for traditional tanpura sound
    const paNote = 67; // G

    track.events.push({
      type: 'noteOn',
      time: 0,
      note: paNote,
      velocity: 30,
      duration: totalTicks
    });

    track.events.push({
      type: 'noteOff',
      time: totalTicks,
      note: paNote,
      velocity: 0
    });

    return track;
  }

  private createLayerTrack(layer: NotationLayer, index: number, options: MIDIExportOptions): MIDITrack {
    const track: MIDITrack = {
      name: layer.name,
      channel: index % 16, // MIDI has 16 channels
      instrument: this.getInstrumentForLayerType(layer.type),
      events: []
    };

    let currentTick = 0;

    for (let row = 0; row < layer.cells.length; row++) {
      for (let col = 1; col < layer.cells[row].length; col++) {
        const cell = layer.cells[row][col];

        if (layer.type === 'vocal' || layer.type === 'custom') {
          if (cell.swar && cell.swar !== '-' && cell.swar !== ',') {
            const midiNote = this.swarToMIDINote(cell.swar, cell.modifiers);
            if (midiNote !== null) {
              track.events.push({
                type: 'noteOn',
                time: currentTick,
                note: midiNote,
                velocity: Math.round(options.velocity * layer.volume),
                duration: options.ticksPerBeat
              });

              track.events.push({
                type: 'noteOff',
                time: currentTick + options.ticksPerBeat,
                note: midiNote,
                velocity: 0
              });
            }
          }
        } else if (layer.type === 'tabla') {
          if (cell.bol && cell.bol !== '-') {
            const midiNote = this.bolToMIDINote(cell.bol);
            if (midiNote !== null) {
              track.events.push({
                type: 'noteOn',
                time: currentTick,
                note: midiNote,
                velocity: Math.round(options.velocity * layer.volume),
                duration: options.ticksPerBeat / 2
              });

              track.events.push({
                type: 'noteOff',
                time: currentTick + options.ticksPerBeat / 2,
                note: midiNote,
                velocity: 0
              });
            }
          }
        }

        currentTick += options.ticksPerBeat;
      }
    }

    return track;
  }

  private getInstrumentForLayerType(type: NotationLayer['type']): number {
    const instruments: { [key: string]: number } = {
      'vocal': 75, // Pan Flute
      'tabla': 0, // (drums on channel 10)
      'tanpura': 109, // Shanai
      'harmonium': 21, // Reed Organ
      'custom': 0
    };

    return instruments[type] || 0;
  }

  private swarToMIDINote(swar: string, modifiers: string[]): number | null {
    // Base octave is 60 (Middle C = Sa)
    const baseOctave = 60;

    const noteMap: { [key: string]: number } = {
      'सा': 0,   // C
      'रे॒': 1,  // C#
      'रे': 2,   // D
      'ग॒': 3,   // D#
      'ग': 4,    // E
      'म': 5,    // F
      'म॑': 6,   // F#
      'प': 7,    // G
      'ध॒': 8,   // G#
      'ध': 9,    // A
      'नी॒': 10, // A#
      'नी': 11   // B
    };

    const noteOffset = noteMap[swar];
    if (noteOffset === undefined) return null;

    let octaveShift = 0;

    if (modifiers.includes('lower')) {
      octaveShift = -12;
    } else if (modifiers.includes('upper')) {
      octaveShift = 12;
    }

    return baseOctave + noteOffset + octaveShift;
  }

  private bolToMIDINote(bol: string): number | null {
    // Map tabla bols to MIDI drum notes (General MIDI percussion)
    const bolMap: { [key: string]: number } = {
      'धा': 36,  // Bass Drum 1
      'धिं': 38, // Acoustic Snare
      'धिर': 40, // Electric Snare
      'धिन': 39, // Hand Clap
      'ता': 42,  // Closed Hi-Hat
      'ति': 44,  // Pedal Hi-Hat
      'तिं': 46, // Open Hi-Hat
      'तिरकिट': 49, // Crash Cymbal
      'का': 51,  // Ride Cymbal
      'गे': 50,  // High Tom
      'ना': 48,  // Hi Mid Tom
      'दिन': 47  // Low-Mid Tom
    };

    return bolMap[bol] || null;
  }

  private buildMIDIFile(tracks: MIDITrack[], options: MIDIExportOptions): Uint8Array {
    const chunks: Uint8Array[] = [];

    // Build header chunk
    const headerChunk = this.buildHeaderChunk(tracks.length, options.ticksPerBeat);
    chunks.push(headerChunk);

    // Build track chunks
    for (const track of tracks) {
      const trackChunk = this.buildTrackChunk(track, options);
      chunks.push(trackChunk);
    }

    // Combine all chunks
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const midiData = new Uint8Array(totalLength);

    let offset = 0;
    for (const chunk of chunks) {
      midiData.set(chunk, offset);
      offset += chunk.length;
    }

    return midiData;
  }

  private buildHeaderChunk(trackCount: number, ticksPerBeat: number): Uint8Array {
    const data = new Uint8Array(14);
    let offset = 0;

    // Chunk type 'MThd'
    data[offset++] = 77;  // M
    data[offset++] = 84;  // T
    data[offset++] = 104; // h
    data[offset++] = 100; // d

    // Chunk length (always 6 for header)
    data[offset++] = 0;
    data[offset++] = 0;
    data[offset++] = 0;
    data[offset++] = 6;

    // Format (1 = multiple tracks, synchronous)
    data[offset++] = 0;
    data[offset++] = 1;

    // Number of tracks
    data[offset++] = (trackCount >> 8) & 0xFF;
    data[offset++] = trackCount & 0xFF;

    // Ticks per quarter note
    data[offset++] = (ticksPerBeat >> 8) & 0xFF;
    data[offset++] = ticksPerBeat & 0xFF;

    return data;
  }

  private buildTrackChunk(track: MIDITrack, options: MIDIExportOptions): Uint8Array {
    const events: number[] = [];

    // Track name meta event
    events.push(...this.createMetaEvent(0, 0x03, this.stringToBytes(track.name)));

    // Instrument change (Program Change)
    events.push(...this.createProgramChange(0, track.channel, track.instrument));

    // Tempo meta event
    events.push(...this.createTempoEvent(0, options.tempo));

    // Sort events by time
    const sortedEvents = [...track.events].sort((a, b) => a.time - b.time);

    let lastTime = 0;

    for (const event of sortedEvents) {
      const deltaTime = event.time - lastTime;

      if (event.type === 'noteOn' && event.note !== undefined && event.velocity !== undefined) {
        events.push(...this.createNoteEvent(deltaTime, 0x90 + track.channel, event.note, event.velocity));
      } else if (event.type === 'noteOff' && event.note !== undefined) {
        events.push(...this.createNoteEvent(deltaTime, 0x80 + track.channel, event.note, 0));
      }

      lastTime = event.time;
    }

    // End of track
    events.push(...this.createMetaEvent(0, 0x2F, []));

    // Build chunk
    const data = new Uint8Array(8 + events.length);
    let offset = 0;

    // Chunk type 'MTrk'
    data[offset++] = 77;  // M
    data[offset++] = 84;  // T
    data[offset++] = 114; // r
    data[offset++] = 107; // k

    // Chunk length
    const length = events.length;
    data[offset++] = (length >> 24) & 0xFF;
    data[offset++] = (length >> 16) & 0xFF;
    data[offset++] = (length >> 8) & 0xFF;
    data[offset++] = length & 0xFF;

    // Events
    data.set(events, offset);

    return data;
  }

  private createNoteEvent(deltaTime: number, status: number, note: number, velocity: number): number[] {
    return [
      ...this.encodeVariableLength(deltaTime),
      status,
      note,
      velocity
    ];
  }

  private createProgramChange(deltaTime: number, channel: number, program: number): number[] {
    return [
      ...this.encodeVariableLength(deltaTime),
      0xC0 + channel,
      program
    ];
  }

  private createTempoEvent(deltaTime: number, bpm: number): number[] {
    const microsecondsPerQuarter = Math.round(60000000 / bpm);

    return [
      ...this.encodeVariableLength(deltaTime),
      0xFF, // Meta event
      0x51, // Tempo
      0x03, // Length
      (microsecondsPerQuarter >> 16) & 0xFF,
      (microsecondsPerQuarter >> 8) & 0xFF,
      microsecondsPerQuarter & 0xFF
    ];
  }

  private createMetaEvent(deltaTime: number, type: number, data: number[]): number[] {
    return [
      ...this.encodeVariableLength(deltaTime),
      0xFF,
      type,
      ...this.encodeVariableLength(data.length),
      ...data
    ];
  }

  private encodeVariableLength(value: number): number[] {
    const result: number[] = [];
    let buffer = value & 0x7F;

    while ((value >>= 7) > 0) {
      buffer <<= 8;
      buffer |= 0x80;
      buffer += (value & 0x7F);
    }

    while (true) {
      result.push(buffer & 0xFF);
      if (buffer & 0x80) {
        buffer >>= 8;
      } else {
        break;
      }
    }

    return result;
  }

  private stringToBytes(str: string): number[] {
    const bytes: number[] = [];
    for (let i = 0; i < str.length; i++) {
      bytes.push(str.charCodeAt(i));
    }
    return bytes;
  }

  downloadMIDI(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.mid') ? filename : `${filename}.mid`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
