import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

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

  constructor() {
    this.checkExistingSession();
  }

  private checkExistingSession(): void {
    // Check for existing session in localStorage
    const storedUser = localStorage.getItem('swaralipi_user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        this.authState.user = user;
        this.authState.isAuthenticated = true;
        this.authStateSubject.next(this.authState);
      } catch (error) {
        console.error('Error parsing stored user:', error);
        localStorage.removeItem('swaralipi_user');
      }
    }
  }

  async signUp(email: string, password: string, displayName: string): Promise<User> {
    this.authState.isLoading = true;
    this.authState.error = null;
    this.authStateSubject.next(this.authState);

    try {
      // Simulate API call to authentication service
      await this.simulateAPICall(1000);

      const user: User = {
        id: this.generateUserId(),
        email,
        displayName,
        emailVerified: false,
        createdAt: new Date(),
        lastLoginAt: new Date(),
        preferences: this.getDefaultPreferences()
      };

      this.authState.user = user;
      this.authState.isAuthenticated = true;
      this.authState.isLoading = false;

      // Store user in localStorage (in production, use secure token)
      localStorage.setItem('swaralipi_user', JSON.stringify(user));

      this.authStateSubject.next(this.authState);
      return user;
    } catch (error: any) {
      this.authState.isLoading = false;
      this.authState.error = error.message || 'Sign up failed';
      this.authStateSubject.next(this.authState);
      throw error;
    }
  }

  async signIn(email: string, password: string): Promise<User> {
    this.authState.isLoading = true;
    this.authState.error = null;
    this.authStateSubject.next(this.authState);

    try {
      // Simulate API call
      await this.simulateAPICall(1000);

      // In production, this would verify credentials with backend
      const storedUser = localStorage.getItem('swaralipi_user');
      let user: User;

      if (storedUser) {
        user = JSON.parse(storedUser);
        user.lastLoginAt = new Date();
      } else {
        // Create mock user for demo
        user = {
          id: this.generateUserId(),
          email,
          displayName: email.split('@')[0],
          emailVerified: true,
          createdAt: new Date(),
          lastLoginAt: new Date(),
          preferences: this.getDefaultPreferences()
        };
      }

      this.authState.user = user;
      this.authState.isAuthenticated = true;
      this.authState.isLoading = false;

      localStorage.setItem('swaralipi_user', JSON.stringify(user));

      this.authStateSubject.next(this.authState);
      return user;
    } catch (error: any) {
      this.authState.isLoading = false;
      this.authState.error = error.message || 'Sign in failed';
      this.authStateSubject.next(this.authState);
      throw error;
    }
  }

  async signInWithGoogle(): Promise<User> {
    this.authState.isLoading = true;
    this.authStateSubject.next(this.authState);

    try {
      await this.simulateAPICall(1500);

      const user: User = {
        id: this.generateUserId(),
        email: 'user@gmail.com',
        displayName: 'Google User',
        photoURL: 'https://via.placeholder.com/150',
        emailVerified: true,
        createdAt: new Date(),
        lastLoginAt: new Date(),
        preferences: this.getDefaultPreferences()
      };

      this.authState.user = user;
      this.authState.isAuthenticated = true;
      this.authState.isLoading = false;

      localStorage.setItem('swaralipi_user', JSON.stringify(user));

      this.authStateSubject.next(this.authState);
      return user;
    } catch (error: any) {
      this.authState.isLoading = false;
      this.authState.error = error.message || 'Google sign in failed';
      this.authStateSubject.next(this.authState);
      throw error;
    }
  }

  async signOut(): Promise<void> {
    this.authState.user = null;
    this.authState.isAuthenticated = false;
    this.authState.error = null;

    localStorage.removeItem('swaralipi_user');

    this.authStateSubject.next(this.authState);
  }

  getCurrentUser(): User | null {
    return this.authState.user;
  }

  isAuthenticated(): boolean {
    return this.authState.isAuthenticated;
  }

  async updateProfile(updates: Partial<User>): Promise<User> {
    if (!this.authState.user) {
      throw new Error('No user logged in');
    }

    this.authState.user = {
      ...this.authState.user,
      ...updates
    };

    localStorage.setItem('swaralipi_user', JSON.stringify(this.authState.user));
    this.authStateSubject.next(this.authState);

    return this.authState.user;
  }

  async updatePreferences(preferences: Partial<UserPreferences>): Promise<void> {
    if (!this.authState.user) {
      throw new Error('No user logged in');
    }

    this.authState.user.preferences = {
      ...this.authState.user.preferences,
      ...preferences
    } as UserPreferences;

    localStorage.setItem('swaralipi_user', JSON.stringify(this.authState.user));
    this.authStateSubject.next(this.authState);
  }

  async sendPasswordResetEmail(email: string): Promise<void> {
    await this.simulateAPICall(1000);
    console.log(`Password reset email sent to ${email}`);
  }

  async verifyEmail(): Promise<void> {
    if (!this.authState.user) {
      throw new Error('No user logged in');
    }

    await this.simulateAPICall(1000);
    this.authState.user.emailVerified = true;
    localStorage.setItem('swaralipi_user', JSON.stringify(this.authState.user));
    this.authStateSubject.next(this.authState);
  }

  async deleteAccount(): Promise<void> {
    if (!this.authState.user) {
      throw new Error('No user logged in');
    }

    await this.simulateAPICall(1000);
    await this.signOut();
  }

  private generateUserId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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

  private simulateAPICall(delay: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, delay));
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
