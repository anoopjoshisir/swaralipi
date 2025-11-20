import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification,
  deleteUser,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  Firestore
} from 'firebase/firestore';
import { FirebaseConfigService } from './firebase-config.service';

export interface User {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  emailVerified: boolean;
  createdAt: Date;
  lastLoginAt: Date;
  preferences?: UserPreferences;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: 'hindi' | 'english';
  autoSave: boolean;
  defaultTaal: string;
  defaultTempo: number;
  notificationSettings: {
    email: boolean;
    collaboration: boolean;
    comments: boolean;
  };
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private authState: AuthState = {
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null
  };

  private authStateSubject = new BehaviorSubject<AuthState>(this.authState);
  public authState$ = this.authStateSubject.asObservable();
  private firestore: Firestore;

  constructor(private firebaseConfig: FirebaseConfigService) {
    this.firestore = this.firebaseConfig.firestore;
    this.initializeAuthListener();
  }

  /**
   * Initialize Firebase auth state listener
   */
  private initializeAuthListener(): void {
    onAuthStateChanged(this.firebaseConfig.auth, async (firebaseUser) => {
      this.authState.isLoading = true;
      this.authStateSubject.next(this.authState);

      if (firebaseUser) {
        // User is signed in
        try {
          const user = await this.loadUserData(firebaseUser);
          this.authState.user = user;
          this.authState.isAuthenticated = true;
        } catch (error) {
          console.error('Error loading user data:', error);
          this.authState.error = 'Failed to load user data';
        }
      } else {
        // User is signed out
        this.authState.user = null;
        this.authState.isAuthenticated = false;
      }

      this.authState.isLoading = false;
      this.authStateSubject.next(this.authState);
    });
  }

  /**
   * Load user data from Firestore
   */
  private async loadUserData(firebaseUser: FirebaseUser): Promise<User> {
    const userDocRef = doc(this.firestore, 'users', firebaseUser.uid);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      const data = userDoc.data();
      return {
        id: firebaseUser.uid,
        email: firebaseUser.email!,
        displayName: firebaseUser.displayName || data.displayName,
        photoURL: firebaseUser.photoURL || data.photoURL,
        emailVerified: firebaseUser.emailVerified,
        createdAt: data.createdAt?.toDate() || new Date(),
        lastLoginAt: new Date(),
        preferences: data.preferences || this.getDefaultPreferences()
      };
    } else {
      // Create new user document
      const user: User = {
        id: firebaseUser.uid,
        email: firebaseUser.email!,
        displayName: firebaseUser.displayName || firebaseUser.email!.split('@')[0],
        photoURL: firebaseUser.photoURL,
        emailVerified: firebaseUser.emailVerified,
        createdAt: new Date(),
        lastLoginAt: new Date(),
        preferences: this.getDefaultPreferences()
      };

      await this.createUserDocument(user);
      return user;
    }
  }

  /**
   * Create user document in Firestore
   */
  private async createUserDocument(user: User): Promise<void> {
    const userDocRef = doc(this.firestore, 'users', user.id);
    await setDoc(userDocRef, {
      uid: user.id,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      emailVerified: user.emailVerified,
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
      preferences: user.preferences,
      compositionCount: 0,
      recordingCount: 0,
      storageUsed: 0
    });
  }

  async signUp(email: string, password: string, displayName: string): Promise<User> {
    this.authState.isLoading = true;
    this.authState.error = null;
    this.authStateSubject.next(this.authState);

    try {
      // Create Firebase user
      const userCredential = await createUserWithEmailAndPassword(
        this.firebaseConfig.auth,
        email,
        password
      );

      // Update display name
      await updateProfile(userCredential.user, { displayName });

      // Send email verification
      await sendEmailVerification(userCredential.user);

      // Load user data (will create Firestore document)
      const user = await this.loadUserData(userCredential.user);

      this.authState.user = user;
      this.authState.isAuthenticated = true;
      this.authState.isLoading = false;
      this.authStateSubject.next(this.authState);

      return user;
    } catch (error: any) {
      this.authState.isLoading = false;
      this.authState.error = this.getErrorMessage(error);
      this.authStateSubject.next(this.authState);
      throw new Error(this.authState.error);
    }
  }

  async signIn(email: string, password: string): Promise<User> {
    this.authState.isLoading = true;
    this.authState.error = null;
    this.authStateSubject.next(this.authState);

    try {
      // Sign in with Firebase
      const userCredential = await signInWithEmailAndPassword(
        this.firebaseConfig.auth,
        email,
        password
      );

      // Update last login
      const userDocRef = doc(this.firestore, 'users', userCredential.user.uid);
      await updateDoc(userDocRef, {
        lastLoginAt: serverTimestamp()
      });

      // Load user data
      const user = await this.loadUserData(userCredential.user);

      this.authState.user = user;
      this.authState.isAuthenticated = true;
      this.authState.isLoading = false;
      this.authStateSubject.next(this.authState);

      return user;
    } catch (error: any) {
      this.authState.isLoading = false;
      this.authState.error = this.getErrorMessage(error);
      this.authStateSubject.next(this.authState);
      throw new Error(this.authState.error);
    }
  }

  async signInWithGoogle(): Promise<User> {
    this.authState.isLoading = true;
    this.authState.error = null;
    this.authStateSubject.next(this.authState);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account'
      });

      const userCredential = await signInWithPopup(this.firebaseConfig.auth, provider);

      // Update last login
      const userDocRef = doc(this.firestore, 'users', userCredential.user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        await updateDoc(userDocRef, {
          lastLoginAt: serverTimestamp()
        });
      }

      // Load user data
      const user = await this.loadUserData(userCredential.user);

      this.authState.user = user;
      this.authState.isAuthenticated = true;
      this.authState.isLoading = false;
      this.authStateSubject.next(this.authState);

      return user;
    } catch (error: any) {
      this.authState.isLoading = false;
      this.authState.error = this.getErrorMessage(error);
      this.authStateSubject.next(this.authState);
      throw new Error(this.authState.error);
    }
  }

  async signOut(): Promise<void> {
    try {
      await signOut(this.firebaseConfig.auth);

      this.authState.user = null;
      this.authState.isAuthenticated = false;
      this.authState.error = null;
      this.authStateSubject.next(this.authState);
    } catch (error: any) {
      console.error('Error signing out:', error);
      throw error;
    }
  }

  getCurrentUser(): User | null {
    return this.authState.user;
  }

  isAuthenticated(): boolean {
    return this.authState.isAuthenticated;
  }

  async updateProfile(updates: Partial<User>): Promise<User> {
    if (!this.authState.user || !this.firebaseConfig.auth.currentUser) {
      throw new Error('No user logged in');
    }

    try {
      // Update Firebase Auth profile
      if (updates.displayName || updates.photoURL) {
        await updateProfile(this.firebaseConfig.auth.currentUser, {
          displayName: updates.displayName,
          photoURL: updates.photoURL
        });
      }

      // Update Firestore user document
      const userDocRef = doc(this.firestore, 'users', this.authState.user.id);
      const updateData: any = {};

      if (updates.displayName) updateData.displayName = updates.displayName;
      if (updates.photoURL) updateData.photoURL = updates.photoURL;

      await updateDoc(userDocRef, updateData);

      // Update local state
      this.authState.user = {
        ...this.authState.user,
        ...updates
      };

      this.authStateSubject.next(this.authState);
      return this.authState.user;
    } catch (error: any) {
      console.error('Error updating profile:', error);
      throw error;
    }
  }

  async updatePreferences(preferences: Partial<UserPreferences>): Promise<void> {
    if (!this.authState.user) {
      throw new Error('No user logged in');
    }

    try {
      const userDocRef = doc(this.firestore, 'users', this.authState.user.id);
      const updatedPreferences = {
        ...this.authState.user.preferences,
        ...preferences
      };

      await updateDoc(userDocRef, {
        preferences: updatedPreferences
      });

      this.authState.user.preferences = updatedPreferences as UserPreferences;
      this.authStateSubject.next(this.authState);
    } catch (error: any) {
      console.error('Error updating preferences:', error);
      throw error;
    }
  }

  async sendPasswordResetEmail(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(this.firebaseConfig.auth, email);
    } catch (error: any) {
      console.error('Error sending password reset email:', error);
      throw new Error(this.getErrorMessage(error));
    }
  }

  async verifyEmail(): Promise<void> {
    if (!this.firebaseConfig.auth.currentUser) {
      throw new Error('No user logged in');
    }

    try {
      await sendEmailVerification(this.firebaseConfig.auth.currentUser);
    } catch (error: any) {
      console.error('Error sending verification email:', error);
      throw new Error(this.getErrorMessage(error));
    }
  }

  async deleteAccount(): Promise<void> {
    if (!this.firebaseConfig.auth.currentUser || !this.authState.user) {
      throw new Error('No user logged in');
    }

    try {
      // Delete user document from Firestore
      // Note: Cloud Functions should handle cleanup of user's compositions, recordings, etc.
      await deleteUser(this.firebaseConfig.auth.currentUser);
    } catch (error: any) {
      console.error('Error deleting account:', error);
      throw new Error(this.getErrorMessage(error));
    }
  }

  private getDefaultPreferences(): UserPreferences {
    return {
      theme: 'light',
      language: 'hindi',
      autoSave: true,
      defaultTaal: 'teen',
      defaultTempo: 120,
      notificationSettings: {
        email: true,
        collaboration: true,
        comments: true
      }
    };
  }

  /**
   * Convert Firebase error to user-friendly message
   */
  private getErrorMessage(error: any): string {
    switch (error.code) {
      case 'auth/email-already-in-use':
        return 'Email already in use';
      case 'auth/invalid-email':
        return 'Invalid email address';
      case 'auth/operation-not-allowed':
        return 'Operation not allowed';
      case 'auth/weak-password':
        return 'Password is too weak';
      case 'auth/user-disabled':
        return 'Account has been disabled';
      case 'auth/user-not-found':
        return 'User not found';
      case 'auth/wrong-password':
        return 'Incorrect password';
      case 'auth/invalid-credential':
        return 'Invalid credentials';
      case 'auth/popup-closed-by-user':
        return 'Sign in cancelled';
      case 'auth/network-request-failed':
        return 'Network error. Please check your connection';
      case 'auth/too-many-requests':
        return 'Too many attempts. Please try again later';
      default:
        return error.message || 'An error occurred';
    }
  }

  // Get user initials for avatar
  getUserInitials(): string {
    if (!this.authState.user) return '?';
    return this.authState.user.displayName
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }
}
