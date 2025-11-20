import { Injectable } from '@angular/core';
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { environment } from '../../environments/environment';

/**
 * Firebase Configuration Service
 * Provides centralized Firebase initialization and instance management
 */
@Injectable({
  providedIn: 'root'
})
export class FirebaseConfigService {
  private app: FirebaseApp;
  private _auth: Auth;
  private _firestore: Firestore;
  private _storage: FirebaseStorage;
  private initialized = false;

  constructor() {
    this.initializeFirebase();
  }

  /**
   * Initialize Firebase app and services
   */
  private initializeFirebase(): void {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize Firebase app
      this.app = initializeApp(environment.firebase);

      // Initialize Authentication
      this._auth = getAuth(this.app);

      // Initialize Firestore with offline persistence
      this._firestore = getFirestore(this.app);

      // Enable offline persistence for Firestore
      if (environment.features.enableOfflineSync) {
        enableIndexedDbPersistence(this._firestore).catch((err) => {
          if (err.code === 'failed-precondition') {
            // Multiple tabs open, persistence can only be enabled in one tab at a time
            console.warn('Firestore persistence failed: Multiple tabs open');
          } else if (err.code === 'unimplemented') {
            // Browser doesn't support persistence
            console.warn('Firestore persistence not supported');
          }
        });
      }

      // Initialize Storage
      this._storage = getStorage(this.app);

      this.initialized = true;
      console.log('Firebase initialized successfully');
    } catch (error) {
      console.error('Error initializing Firebase:', error);
      throw error;
    }
  }

  /**
   * Get Firebase Auth instance
   */
  get auth(): Auth {
    if (!this._auth) {
      throw new Error('Firebase Auth not initialized');
    }
    return this._auth;
  }

  /**
   * Get Firestore instance
   */
  get firestore(): Firestore {
    if (!this._firestore) {
      throw new Error('Firestore not initialized');
    }
    return this._firestore;
  }

  /**
   * Get Firebase Storage instance
   */
  get storage(): FirebaseStorage {
    if (!this._storage) {
      throw new Error('Firebase Storage not initialized');
    }
    return this._storage;
  }

  /**
   * Check if Firebase is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}
