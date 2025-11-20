import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { NotationGrid, NotationLayer, CompositionLyrics } from '../models/notation.model';
import { AuthService } from './auth';

export interface Version {
  id: string;
  compositionId: string;
  versionNumber: number;
  title: string;
  grid: NotationGrid;
  layers?: NotationLayer[];
  lyrics?: CompositionLyrics;
  createdBy: string;
  createdByName: string;
  createdAt: Date;
  changeDescription?: string;
  tags: string[];
  size: number; // in bytes
}

export interface VersionComparison {
  added: { row: number; col: number }[];
  modified: { row: number; col: number }[];
  deleted: { row: number; col: number }[];
}

@Injectable({
  providedIn: 'root'
})
export class VersionHistoryService {
  private versions: Map<string, Version[]> = new Map();
  private currentVersions: Map<string, number> = new Map();

  private versionsSubject = new BehaviorSubject<Version[]>([]);
  public versions$ = this.versionsSubject.asObservable();

  private readonly MAX_VERSIONS = 50;

  constructor(private authService: AuthService) {
    this.loadFromLocalStorage();
  }

  private loadFromLocalStorage(): void {
    const stored = localStorage.getItem('swaralipi_versions');
    if (stored) {
      try {
        const data = JSON.parse(stored);
        this.versions = new Map(Object.entries(data).map(([key, value]) => [key, value as Version[]]));
      } catch (error) {
        console.error('Error loading versions:', error);
      }
    }

    const storedCurrent = localStorage.getItem('swaralipi_current_versions');
    if (storedCurrent) {
      try {
        const data = JSON.parse(storedCurrent);
        this.currentVersions = new Map(Object.entries(data).map(([key, value]) => [key, value as number]));
      } catch (error) {
        console.error('Error loading current versions:', error);
      }
    }
  }

  private saveToLocalStorage(): void {
    const versionsData = Object.fromEntries(this.versions);
    localStorage.setItem('swaralipi_versions', JSON.stringify(versionsData));

    const currentData = Object.fromEntries(this.currentVersions);
    localStorage.setItem('swaralipi_current_versions', JSON.stringify(currentData));
  }

  private generateVersionId(): string {
    return `ver_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateSize(version: Partial<Version>): number {
    return JSON.stringify(version).length;
  }

  async createVersion(
    compositionId: string,
    grid: NotationGrid,
    changeDescription?: string,
    layers?: NotationLayer[],
    lyrics?: CompositionLyrics
  ): Promise<Version> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      throw new Error('User must be authenticated to create versions');
    }

    const compositionVersions = this.versions.get(compositionId) || [];
    const currentVersionNumber = this.currentVersions.get(compositionId) || 0;
    const newVersionNumber = currentVersionNumber + 1;

    const version: Version = {
      id: this.generateVersionId(),
      compositionId,
      versionNumber: newVersionNumber,
      title: grid.metadata.title || `Version ${newVersionNumber}`,
      grid: JSON.parse(JSON.stringify(grid)), // Deep copy
      layers: layers ? JSON.parse(JSON.stringify(layers)) : undefined,
      lyrics: lyrics ? JSON.parse(JSON.stringify(lyrics)) : undefined,
      createdBy: user.id,
      createdByName: user.displayName,
      createdAt: new Date(),
      changeDescription,
      tags: [],
      size: 0
    };

    version.size = this.calculateSize(version);

    compositionVersions.push(version);

    // Keep only last MAX_VERSIONS
    if (compositionVersions.length > this.MAX_VERSIONS) {
      compositionVersions.shift();
    }

    this.versions.set(compositionId, compositionVersions);
    this.currentVersions.set(compositionId, newVersionNumber);

    this.saveToLocalStorage();
    this.versionsSubject.next(compositionVersions);

    return version;
  }

  getVersions(compositionId: string): Version[] {
    return (this.versions.get(compositionId) || [])
      .sort((a, b) => b.versionNumber - a.versionNumber);
  }

  getVersion(versionId: string): Version | undefined {
    for (const versions of this.versions.values()) {
      const version = versions.find(v => v.id === versionId);
      if (version) return version;
    }
    return undefined;
  }

  getVersionByNumber(compositionId: string, versionNumber: number): Version | undefined {
    const versions = this.versions.get(compositionId) || [];
    return versions.find(v => v.versionNumber === versionNumber);
  }

  getCurrentVersion(compositionId: string): Version | undefined {
    const versionNumber = this.currentVersions.get(compositionId);
    if (!versionNumber) return undefined;

    return this.getVersionByNumber(compositionId, versionNumber);
  }

  async restoreVersion(versionId: string): Promise<Version> {
    const version = this.getVersion(versionId);
    if (!version) {
      throw new Error('Version not found');
    }

    // Create a new version with the restored content
    return this.createVersion(
      version.compositionId,
      version.grid,
      `Restored from version ${version.versionNumber}`,
      version.layers,
      version.lyrics
    );
  }

  deleteVersion(versionId: string): boolean {
    for (const [compId, versions] of this.versions.entries()) {
      const index = versions.findIndex(v => v.id === versionId);
      if (index >= 0) {
        const version = versions[index];

        // Don't allow deleting the current version if it's the only one
        if (versions.length === 1) {
          return false;
        }

        versions.splice(index, 1);
        this.versions.set(compId, versions);
        this.saveToLocalStorage();
        this.versionsSubject.next(versions);
        return true;
      }
    }
    return false;
  }

  compareVersions(versionId1: string, versionId2: string): VersionComparison {
    const v1 = this.getVersion(versionId1);
    const v2 = this.getVersion(versionId2);

    if (!v1 || !v2) {
      throw new Error('One or both versions not found');
    }

    const comparison: VersionComparison = {
      added: [],
      modified: [],
      deleted: []
    };

    const grid1 = v1.grid.cells;
    const grid2 = v2.grid.cells;

    // Compare cells
    const maxRows = Math.max(grid1.length, grid2.length);

    for (let row = 0; row < maxRows; row++) {
      const row1 = grid1[row];
      const row2 = grid2[row];

      if (!row1) {
        // Row added in v2
        if (row2) {
          for (let col = 1; col < row2.length; col++) {
            if (row2[col].swar || row2[col].bol) {
              comparison.added.push({ row, col });
            }
          }
        }
        continue;
      }

      if (!row2) {
        // Row deleted in v2
        for (let col = 1; col < row1.length; col++) {
          if (row1[col].swar || row1[col].bol) {
            comparison.deleted.push({ row, col });
          }
        }
        continue;
      }

      const maxCols = Math.max(row1.length, row2.length);

      for (let col = 1; col < maxCols; col++) {
        const cell1 = row1[col];
        const cell2 = row2[col];

        if (!cell1 || (!cell1.swar && !cell1.bol)) {
          if (cell2 && (cell2.swar || cell2.bol)) {
            comparison.added.push({ row, col });
          }
        } else if (!cell2 || (!cell2.swar && !cell2.bol)) {
          comparison.deleted.push({ row, col });
        } else {
          // Compare cells
          if (cell1.swar !== cell2.swar ||
              cell1.bol !== cell2.bol ||
              JSON.stringify(cell1.modifiers) !== JSON.stringify(cell2.modifiers)) {
            comparison.modified.push({ row, col });
          }
        }
      }
    }

    return comparison;
  }

  tagVersion(versionId: string, tags: string[]): boolean {
    const version = this.getVersion(versionId);
    if (!version) return false;

    version.tags = [...new Set([...version.tags, ...tags])];

    this.saveToLocalStorage();

    // Update subject with the composition versions
    const versions = this.versions.get(version.compositionId) || [];
    this.versionsSubject.next(versions);

    return true;
  }

  searchVersions(compositionId: string, query: string): Version[] {
    const versions = this.getVersions(compositionId);
    const lowerQuery = query.toLowerCase();

    return versions.filter(v =>
      v.title.toLowerCase().includes(lowerQuery) ||
      v.changeDescription?.toLowerCase().includes(lowerQuery) ||
      v.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
      v.createdByName.toLowerCase().includes(lowerQuery)
    );
  }

  getVersionStats(compositionId: string): {
    totalVersions: number;
    totalSize: number;
    oldestVersion: Date | null;
    newestVersion: Date | null;
  } {
    const versions = this.versions.get(compositionId) || [];

    return {
      totalVersions: versions.length,
      totalSize: versions.reduce((sum, v) => sum + v.size, 0),
      oldestVersion: versions.length > 0 ? versions[0].createdAt : null,
      newestVersion: versions.length > 0 ? versions[versions.length - 1].createdAt : null
    };
  }

  exportVersionHistory(compositionId: string): string {
    const versions = this.getVersions(compositionId);
    return JSON.stringify(versions, null, 2);
  }

  async importVersionHistory(compositionId: string, jsonData: string): Promise<number> {
    try {
      const imported: Version[] = JSON.parse(jsonData);
      const existing = this.versions.get(compositionId) || [];

      // Add imported versions
      const combined = [...existing, ...imported];

      // Sort by version number
      combined.sort((a, b) => a.versionNumber - b.versionNumber);

      // Keep only last MAX_VERSIONS
      if (combined.length > this.MAX_VERSIONS) {
        combined.splice(0, combined.length - this.MAX_VERSIONS);
      }

      this.versions.set(compositionId, combined);
      this.saveToLocalStorage();
      this.versionsSubject.next(combined);

      return imported.length;
    } catch (error) {
      console.error('Error importing version history:', error);
      throw error;
    }
  }

  // Auto-save functionality
  async autoSave(
    compositionId: string,
    grid: NotationGrid,
    layers?: NotationLayer[],
    lyrics?: CompositionLyrics
  ): Promise<Version | null> {
    const currentVersion = this.getCurrentVersion(compositionId);

    // Check if there are changes
    if (currentVersion) {
      const currentGrid = JSON.stringify(currentVersion.grid);
      const newGrid = JSON.stringify(grid);

      if (currentGrid === newGrid) {
        return null; // No changes
      }
    }

    // Create auto-save version
    return this.createVersion(
      compositionId,
      grid,
      'Auto-save',
      layers,
      lyrics
    );
  }
}
