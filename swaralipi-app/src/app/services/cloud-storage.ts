import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  increment,
  Timestamp
} from 'firebase/firestore';
import { NotationGrid, CompositionMetadata, NotationLayer, CompositionLyrics } from '../models/notation.model';
import { AuthService } from './auth';
import { FirebaseConfigService } from './firebase-config.service';
import { environment } from '../../environments/environment';

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
  private compositionsSubject = new BehaviorSubject<CloudComposition[]>([]);
  private statsSubject = new BehaviorSubject<StorageStats>({
    totalCompositions: 0,
    storageUsed: 0,
    storageLimit: 100 * 1024 * 1024, // 100 MB
    lastSyncedAt: null
  });

  public compositions$ = this.compositionsSubject.asObservable();
  public stats$ = this.statsSubject.asObservable();

  private unsubscribe: (() => void) | null = null;

  constructor(
    private authService: AuthService,
    private firebaseConfig: FirebaseConfigService
  ) {
    this.initializeRealtimeSync();
  }

  /**
   * Initialize real-time synchronization for user's compositions
   */
  private initializeRealtimeSync(): void {
    this.authService.authState$.subscribe(authState => {
      // Cleanup previous listener
      if (this.unsubscribe) {
        this.unsubscribe();
        this.unsubscribe = null;
      }

      if (authState.isAuthenticated && authState.user) {
        this.setupCompositionsListener(authState.user.id);
        this.updateStats();
      } else {
        this.compositionsSubject.next([]);
        this.statsSubject.next({
          totalCompositions: 0,
          storageUsed: 0,
          storageLimit: 100 * 1024 * 1024,
          lastSyncedAt: null
        });
      }
    });
  }

  /**
   * Setup real-time listener for user's compositions
   */
  private setupCompositionsListener(userId: string): void {
    const db = this.firebaseConfig.firestore;
    const compositionsRef = collection(db, 'compositions');
    const q = query(
      compositionsRef,
      where('userId', '==', userId),
      orderBy('updatedAt', 'desc'),
      limit(environment.features.maxCompositionsPerUser)
    );

    this.unsubscribe = onSnapshot(q, (snapshot) => {
      const compositions: CloudComposition[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        } as CloudComposition;
      });

      this.compositionsSubject.next(compositions);
      this.updateStats();
    }, (error) => {
      console.error('Error listening to compositions:', error);
    });
  }

  /**
   * Calculate composition size in bytes
   */
  private calculateCompositionSize(comp: CloudComposition): number {
    return JSON.stringify(comp).length;
  }

  /**
   * Generate unique composition ID
   */
  private generateCompositionId(): string {
    return `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update storage statistics
   */
  private async updateStats(): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) return;

    try {
      const userDocRef = doc(this.firebaseConfig.firestore, 'users', user.id);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const compositions = this.compositionsSubject.value;
        const storageUsed = compositions.reduce(
          (total, comp) => total + this.calculateCompositionSize(comp),
          0
        );

        this.statsSubject.next({
          totalCompositions: userData.compositionCount || compositions.length,
          storageUsed,
          storageLimit: 100 * 1024 * 1024,
          lastSyncedAt: new Date()
        });
      }
    } catch (error) {
      console.error('Error updating stats:', error);
    }
  }

  /**
   * Save new composition to Firestore
   */
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

    // Check composition limit
    const currentStats = this.statsSubject.value;
    if (currentStats.totalCompositions >= environment.features.maxCompositionsPerUser) {
      throw new Error(`Maximum composition limit (${environment.features.maxCompositionsPerUser}) reached`);
    }

    const compositionId = this.generateCompositionId();
    const composition: CloudComposition = {
      id: compositionId,
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

    try {
      const db = this.firebaseConfig.firestore;
      const compositionRef = doc(db, 'compositions', compositionId);

      await setDoc(compositionRef, {
        ...composition,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Update user's composition count
      const userDocRef = doc(db, 'users', user.id);
      await updateDoc(userDocRef, {
        compositionCount: increment(1)
      });

      return composition;
    } catch (error) {
      console.error('Error saving composition:', error);
      throw error;
    }
  }

  /**
   * Update existing composition
   */
  async updateComposition(
    id: string,
    grid: NotationGrid,
    layers?: NotationLayer[],
    lyrics?: CompositionLyrics
  ): Promise<CloudComposition> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      throw new Error('User must be authenticated');
    }

    try {
      const db = this.firebaseConfig.firestore;
      const compositionRef = doc(db, 'compositions', id);
      const compositionDoc = await getDoc(compositionRef);

      if (!compositionDoc.exists()) {
        throw new Error('Composition not found');
      }

      const data = compositionDoc.data();
      if (data.userId !== user.id) {
        throw new Error('Unauthorized to update this composition');
      }

      const updateData = {
        grid,
        layers,
        lyrics,
        metadata: grid.metadata,
        updatedAt: serverTimestamp(),
        version: increment(1)
      };

      await updateDoc(compositionRef, updateData);

      return {
        ...data,
        ...updateData,
        id,
        updatedAt: new Date(),
        version: data.version + 1
      } as CloudComposition;
    } catch (error) {
      console.error('Error updating composition:', error);
      throw error;
    }
  }

  /**
   * Delete composition
   */
  async deleteComposition(id: string): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      throw new Error('User must be authenticated');
    }

    try {
      const db = this.firebaseConfig.firestore;
      const compositionRef = doc(db, 'compositions', id);
      const compositionDoc = await getDoc(compositionRef);

      if (!compositionDoc.exists()) {
        throw new Error('Composition not found');
      }

      const data = compositionDoc.data();
      if (data.userId !== user.id) {
        throw new Error('Unauthorized to delete this composition');
      }

      await deleteDoc(compositionRef);

      // Update user's composition count
      const userDocRef = doc(db, 'users', user.id);
      await updateDoc(userDocRef, {
        compositionCount: increment(-1)
      });
    } catch (error) {
      console.error('Error deleting composition:', error);
      throw error;
    }
  }

  /**
   * Get single composition
   */
  async getComposition(id: string): Promise<CloudComposition | undefined> {
    try {
      const db = this.firebaseConfig.firestore;
      const compositionRef = doc(db, 'compositions', id);
      const compositionDoc = await getDoc(compositionRef);

      if (!compositionDoc.exists()) {
        return undefined;
      }

      const data = compositionDoc.data();
      return {
        ...data,
        id: compositionDoc.id,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      } as CloudComposition;
    } catch (error) {
      console.error('Error getting composition:', error);
      return undefined;
    }
  }

  /**
   * Get all accessible compositions (owned + shared)
   */
  getAllCompositions(): CloudComposition[] {
    return this.compositionsSubject.value;
  }

  /**
   * Get user's own compositions
   */
  getMyCompositions(): CloudComposition[] {
    const user = this.authService.getCurrentUser();
    if (!user) return [];

    return this.compositionsSubject.value.filter(c => c.userId === user.id);
  }

  /**
   * Get compositions shared with user
   */
  async getSharedCompositions(): Promise<CloudComposition[]> {
    const user = this.authService.getCurrentUser();
    if (!user) return [];

    try {
      const db = this.firebaseConfig.firestore;
      const compositionsRef = collection(db, 'compositions');
      const q = query(
        compositionsRef,
        where('sharedWith', 'array-contains', user.id),
        orderBy('updatedAt', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        } as CloudComposition;
      });
    } catch (error) {
      console.error('Error getting shared compositions:', error);
      return [];
    }
  }

  /**
   * Search compositions
   */
  searchCompositions(query: string): CloudComposition[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllCompositions().filter(c =>
      c.title.toLowerCase().includes(lowerQuery) ||
      c.metadata.raga?.toLowerCase().includes(lowerQuery) ||
      c.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Share composition with users
   */
  async shareComposition(id: string, userIds: string[]): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      throw new Error('User must be authenticated');
    }

    try {
      const db = this.firebaseConfig.firestore;
      const compositionRef = doc(db, 'compositions', id);
      const compositionDoc = await getDoc(compositionRef);

      if (!compositionDoc.exists()) {
        throw new Error('Composition not found');
      }

      const data = compositionDoc.data();
      if (data.userId !== user.id) {
        throw new Error('Unauthorized to share this composition');
      }

      const currentShared = data.sharedWith || [];
      const newShared = [...new Set([...currentShared, ...userIds])];

      await updateDoc(compositionRef, {
        sharedWith: newShared,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error sharing composition:', error);
      throw error;
    }
  }

  /**
   * Unshare composition from user
   */
  async unshareComposition(id: string, userId: string): Promise<void> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('User must be authenticated');
    }

    try {
      const db = this.firebaseConfig.firestore;
      const compositionRef = doc(db, 'compositions', id);
      const compositionDoc = await getDoc(compositionRef);

      if (!compositionDoc.exists()) {
        throw new Error('Composition not found');
      }

      const data = compositionDoc.data();
      if (data.userId !== currentUser.id) {
        throw new Error('Unauthorized to unshare this composition');
      }

      const currentShared = data.sharedWith || [];
      const newShared = currentShared.filter((u: string) => u !== userId);

      await updateDoc(compositionRef, {
        sharedWith: newShared,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error unsharing composition:', error);
      throw error;
    }
  }

  /**
   * Set composition public/private
   */
  async setPublic(id: string, isPublic: boolean): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      throw new Error('User must be authenticated');
    }

    try {
      const db = this.firebaseConfig.firestore;
      const compositionRef = doc(db, 'compositions', id);
      const compositionDoc = await getDoc(compositionRef);

      if (!compositionDoc.exists()) {
        throw new Error('Composition not found');
      }

      const data = compositionDoc.data();
      if (data.userId !== user.id) {
        throw new Error('Unauthorized to modify this composition');
      }

      await updateDoc(compositionRef, {
        isPublic,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error setting public status:', error);
      throw error;
    }
  }

  /**
   * Add tags to composition
   */
  async addTags(id: string, tags: string[]): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      throw new Error('User must be authenticated');
    }

    try {
      const db = this.firebaseConfig.firestore;
      const compositionRef = doc(db, 'compositions', id);
      const compositionDoc = await getDoc(compositionRef);

      if (!compositionDoc.exists()) {
        throw new Error('Composition not found');
      }

      const data = compositionDoc.data();
      if (data.userId !== user.id) {
        throw new Error('Unauthorized to modify this composition');
      }

      const currentTags = data.tags || [];
      const newTags = [...new Set([...currentTags, ...tags])];

      await updateDoc(compositionRef, {
        tags: newTags,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error adding tags:', error);
      throw error;
    }
  }

  /**
   * Duplicate composition
   */
  async duplicateComposition(id: string, newTitle?: string): Promise<CloudComposition> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      throw new Error('User must be authenticated');
    }

    try {
      const original = await this.getComposition(id);
      if (!original) {
        throw new Error('Composition not found');
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

      const db = this.firebaseConfig.firestore;
      const compositionRef = doc(db, 'compositions', duplicate.id);

      await setDoc(compositionRef, {
        ...duplicate,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Update user's composition count
      const userDocRef = doc(db, 'users', user.id);
      await updateDoc(userDocRef, {
        compositionCount: increment(1)
      });

      return duplicate;
    } catch (error) {
      console.error('Error duplicating composition:', error);
      throw error;
    }
  }

  /**
   * Sync with cloud (already real-time, but can force refresh)
   */
  async syncWithCloud(): Promise<void> {
    await this.updateStats();
  }

  /**
   * Get storage stats
   */
  getStats(): StorageStats {
    return this.statsSubject.value;
  }

  /**
   * Export all user's compositions as JSON
   */
  async exportAllCompositions(): Promise<string> {
    const myCompositions = this.getMyCompositions();
    return JSON.stringify(myCompositions, null, 2);
  }

  /**
   * Import compositions from JSON
   */
  async importCompositions(jsonData: string): Promise<number> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      throw new Error('User must be authenticated');
    }

    try {
      const imported: CloudComposition[] = JSON.parse(jsonData);
      const db = this.firebaseConfig.firestore;
      let count = 0;

      for (const comp of imported) {
        const newCompId = this.generateCompositionId();
        const newComp: CloudComposition = {
          ...comp,
          id: newCompId,
          userId: user.id,
          createdAt: new Date(),
          updatedAt: new Date(),
          sharedWith: []
        };

        const compositionRef = doc(db, 'compositions', newCompId);
        await setDoc(compositionRef, {
          ...newComp,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        count++;
      }

      // Update user's composition count
      const userDocRef = doc(db, 'users', user.id);
      await updateDoc(userDocRef, {
        compositionCount: increment(count)
      });

      return count;
    } catch (error) {
      console.error('Error importing compositions:', error);
      throw error;
    }
  }

  /**
   * Cleanup when service is destroyed
   */
  ngOnDestroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }
}
