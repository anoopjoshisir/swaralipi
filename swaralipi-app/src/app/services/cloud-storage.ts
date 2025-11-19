import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { NotationGrid, CompositionMetadata, NotationLayer, CompositionLyrics } from '../models/notation.model';
import { AuthService } from './auth';

export interface CloudComposition {
  id: string;
  userId: string;
  title: string;
  grid: NotationGrid;
  layers?: NotationLayer[];
  lyrics?: CompositionLyrics;
  metadata: CompositionMetadata;
  createdAt: Date;
  updatedAt: Date;
  isPublic: boolean;
  sharedWith: string[]; // User IDs
  tags: string[];
  thumbnail?: string;
  version: number;
}

export interface StorageStats {
  totalCompositions: number;
  storageUsed: number; // in bytes
  storageLimit: number; // in bytes
  lastSyncedAt: Date | null;
}

@Injectable({
  providedIn: 'root'
})
export class CloudStorageService {
  private compositions: Map<string, CloudComposition> = new Map();
  private syncInProgress = false;

  private compositionsSubject = new BehaviorSubject<CloudComposition[]>([]);
  private statsSubject = new BehaviorSubject<StorageStats>({
    totalCompositions: 0,
    storageUsed: 0,
    storageLimit: 100 * 1024 * 1024, // 100 MB
    lastSyncedAt: null
  });

  public compositions$ = this.compositionsSubject.asObservable();
  public stats$ = this.statsSubject.asObservable();

  constructor(private authService: AuthService) {
    this.loadFromLocalStorage();
  }

  private loadFromLocalStorage(): void {
    const stored = localStorage.getItem('swaralipi_cloud_compositions');
    if (stored) {
      try {
        const data = JSON.parse(stored);
        this.compositions = new Map(Object.entries(data));
        this.updateCompositionsList();
        this.updateStats();
      } catch (error) {
        console.error('Error loading compositions from localStorage:', error);
      }
    }
  }

  private saveToLocalStorage(): void {
    const data = Object.fromEntries(this.compositions);
    localStorage.setItem('swaralipi_cloud_compositions', JSON.stringify(data));
  }

  private updateCompositionsList(): void {
    const user = this.authService.getCurrentUser();
    if (user) {
      const userCompositions = Array.from(this.compositions.values())
        .filter(c => c.userId === user.id || c.sharedWith.includes(user.id));
      this.compositionsSubject.next(userCompositions);
    }
  }

  private updateStats(): void {
    const user = this.authService.getCurrentUser();
    if (user) {
      const userCompositions = Array.from(this.compositions.values())
        .filter(c => c.userId === user.id);

      const storageUsed = userCompositions.reduce((total, comp) => {
        return total + this.calculateCompositionSize(comp);
      }, 0);

      this.statsSubject.next({
        totalCompositions: userCompositions.length,
        storageUsed,
        storageLimit: 100 * 1024 * 1024,
        lastSyncedAt: new Date()
      });
    }
  }

  private calculateCompositionSize(comp: CloudComposition): number {
    return JSON.stringify(comp).length;
  }

  private generateCompositionId(): string {
    return `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async saveComposition(
    grid: NotationGrid,
    title?: string,
    layers?: NotationLayer[],
    lyrics?: CompositionLyrics
  ): Promise<CloudComposition> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      throw new Error('User must be authenticated to save to cloud');
    }

    const composition: CloudComposition = {
      id: this.generateCompositionId(),
      userId: user.id,
      title: title || grid.metadata.title || 'Untitled Composition',
      grid,
      layers,
      lyrics,
      metadata: grid.metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
      isPublic: false,
      sharedWith: [],
      tags: [],
      version: 1
    };

    this.compositions.set(composition.id, composition);
    this.saveToLocalStorage();
    this.updateCompositionsList();
    this.updateStats();

    // Simulate cloud sync
    await this.simulateCloudSync(composition);

    return composition;
  }

  async updateComposition(
    id: string,
    grid: NotationGrid,
    layers?: NotationLayer[],
    lyrics?: CompositionLyrics
  ): Promise<CloudComposition> {
    const composition = this.compositions.get(id);
    if (!composition) {
      throw new Error('Composition not found');
    }

    const user = this.authService.getCurrentUser();
    if (!user || composition.userId !== user.id) {
      throw new Error('Unauthorized to update this composition');
    }

    composition.grid = grid;
    composition.layers = layers;
    composition.lyrics = lyrics;
    composition.metadata = grid.metadata;
    composition.updatedAt = new Date();
    composition.version++;

    this.compositions.set(id, composition);
    this.saveToLocalStorage();
    this.updateCompositionsList();
    this.updateStats();

    await this.simulateCloudSync(composition);

    return composition;
  }

  async deleteComposition(id: string): Promise<void> {
    const composition = this.compositions.get(id);
    if (!composition) {
      throw new Error('Composition not found');
    }

    const user = this.authService.getCurrentUser();
    if (!user || composition.userId !== user.id) {
      throw new Error('Unauthorized to delete this composition');
    }

    this.compositions.delete(id);
    this.saveToLocalStorage();
    this.updateCompositionsList();
    this.updateStats();

    await this.simulateCloudSync();
  }

  getComposition(id: string): CloudComposition | undefined {
    return this.compositions.get(id);
  }

  getAllCompositions(): CloudComposition[] {
    const user = this.authService.getCurrentUser();
    if (!user) return [];

    return Array.from(this.compositions.values())
      .filter(c => c.userId === user.id || c.sharedWith.includes(user.id))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  getMyCompositions(): CloudComposition[] {
    const user = this.authService.getCurrentUser();
    if (!user) return [];

    return Array.from(this.compositions.values())
      .filter(c => c.userId === user.id)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  getSharedCompositions(): CloudComposition[] {
    const user = this.authService.getCurrentUser();
    if (!user) return [];

    return Array.from(this.compositions.values())
      .filter(c => c.sharedWith.includes(user.id))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  searchCompositions(query: string): CloudComposition[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllCompositions().filter(c =>
      c.title.toLowerCase().includes(lowerQuery) ||
      c.metadata.raga?.toLowerCase().includes(lowerQuery) ||
      c.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  async shareComposition(id: string, userIds: string[]): Promise<void> {
    const composition = this.compositions.get(id);
    if (!composition) {
      throw new Error('Composition not found');
    }

    const user = this.authService.getCurrentUser();
    if (!user || composition.userId !== user.id) {
      throw new Error('Unauthorized to share this composition');
    }

    composition.sharedWith = [...new Set([...composition.sharedWith, ...userIds])];
    this.compositions.set(id, composition);
    this.saveToLocalStorage();
    this.updateCompositionsList();

    await this.simulateCloudSync(composition);
  }

  async unshareComposition(id: string, userId: string): Promise<void> {
    const composition = this.compositions.get(id);
    if (!composition) {
      throw new Error('Composition not found');
    }

    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || composition.userId !== currentUser.id) {
      throw new Error('Unauthorized to unshare this composition');
    }

    composition.sharedWith = composition.sharedWith.filter(u => u !== userId);
    this.compositions.set(id, composition);
    this.saveToLocalStorage();
    this.updateCompositionsList();

    await this.simulateCloudSync(composition);
  }

  async setPublic(id: string, isPublic: boolean): Promise<void> {
    const composition = this.compositions.get(id);
    if (!composition) {
      throw new Error('Composition not found');
    }

    const user = this.authService.getCurrentUser();
    if (!user || composition.userId !== user.id) {
      throw new Error('Unauthorized to modify this composition');
    }

    composition.isPublic = isPublic;
    this.compositions.set(id, composition);
    this.saveToLocalStorage();
    this.updateCompositionsList();

    await this.simulateCloudSync(composition);
  }

  async addTags(id: string, tags: string[]): Promise<void> {
    const composition = this.compositions.get(id);
    if (!composition) {
      throw new Error('Composition not found');
    }

    const user = this.authService.getCurrentUser();
    if (!user || composition.userId !== user.id) {
      throw new Error('Unauthorized to modify this composition');
    }

    composition.tags = [...new Set([...composition.tags, ...tags])];
    this.compositions.set(id, composition);
    this.saveToLocalStorage();
    this.updateCompositionsList();

    await this.simulateCloudSync(composition);
  }

  async duplicateComposition(id: string, newTitle?: string): Promise<CloudComposition> {
    const original = this.compositions.get(id);
    if (!original) {
      throw new Error('Composition not found');
    }

    const user = this.authService.getCurrentUser();
    if (!user) {
      throw new Error('User must be authenticated');
    }

    const duplicate: CloudComposition = {
      ...JSON.parse(JSON.stringify(original)),
      id: this.generateCompositionId(),
      userId: user.id,
      title: newTitle || `${original.title} (Copy)`,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      sharedWith: []
    };

    this.compositions.set(duplicate.id, duplicate);
    this.saveToLocalStorage();
    this.updateCompositionsList();
    this.updateStats();

    await this.simulateCloudSync(duplicate);

    return duplicate;
  }

  async syncWithCloud(): Promise<void> {
    if (this.syncInProgress) return;

    this.syncInProgress = true;
    try {
      // Simulate cloud sync
      await this.simulateCloudSync();
      this.updateStats();
    } finally {
      this.syncInProgress = false;
    }
  }

  getStats(): StorageStats {
    return this.statsSubject.value;
  }

  private async simulateCloudSync(composition?: CloudComposition): Promise<void> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log('Cloud sync completed', composition?.id || 'all compositions');
  }

  // Export all user's compositions
  async exportAllCompositions(): Promise<string> {
    const myCompositions = this.getMyCompositions();
    return JSON.stringify(myCompositions, null, 2);
  }

  // Import compositions
  async importCompositions(jsonData: string): Promise<number> {
    try {
      const imported: CloudComposition[] = JSON.parse(jsonData);
      const user = this.authService.getCurrentUser();
      if (!user) {
        throw new Error('User must be authenticated');
      }

      let count = 0;
      for (const comp of imported) {
        const newComp: CloudComposition = {
          ...comp,
          id: this.generateCompositionId(),
          userId: user.id,
          createdAt: new Date(),
          updatedAt: new Date(),
          sharedWith: []
        };

        this.compositions.set(newComp.id, newComp);
        count++;
      }

      this.saveToLocalStorage();
      this.updateCompositionsList();
      this.updateStats();

      return count;
    } catch (error) {
      console.error('Error importing compositions:', error);
      throw error;
    }
  }
}
