import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { AuthService, User } from './auth';
import { NotationCell, CellPosition } from '../models/notation.model';

export interface Comment {
  id: string;
  compositionId: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  text: string;
  cellPosition?: CellPosition; // Comment on specific cell
  rowIndex?: number; // Comment on entire row
  createdAt: Date;
  updatedAt: Date;
  replies: CommentReply[];
  resolved: boolean;
}

export interface CommentReply {
  id: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  text: string;
  createdAt: Date;
}

export interface CollaboratorPresence {
  userId: string;
  userName: string;
  userPhoto?: string;
  currentCell?: CellPosition;
  color: string; // Cursor color
  lastActive: Date;
}

export interface EditAction {
  id: string;
  userId: string;
  userName: string;
  action: 'edit' | 'insert' | 'delete' | 'paste';
  cellPosition?: CellPosition;
  rowIndex?: number;
  before?: NotationCell;
  after?: NotationCell;
  timestamp: Date;
}

export interface ShareLink {
  id: string;
  compositionId: string;
  createdBy: string;
  accessLevel: 'view' | 'comment' | 'edit';
  expiresAt?: Date;
  password?: string;
  enabled: boolean;
  createdAt: Date;
  accessCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class CollaborationService {
  private comments: Map<string, Comment[]> = new Map();
  private collaborators: Map<string, CollaboratorPresence[]> = new Map();
  private editHistory: Map<string, EditAction[]> = new Map();
  private shareLinks: Map<string, ShareLink> = new Map();

  private commentsSubject = new BehaviorSubject<Comment[]>([]);
  private collaboratorsSubject = new BehaviorSubject<CollaboratorPresence[]>([]);
  private editActionsSubject = new Subject<EditAction>();

  public comments$ = this.commentsSubject.asObservable();
  public collaborators$ = this.collaboratorsSubject.asObservable();
  public editActions$ = this.editActionsSubject.asObservable();

  private currentCompositionId: string | null = null;
  private presenceUpdateInterval: any;

  constructor(private authService: AuthService) {
    this.loadFromLocalStorage();
    this.startPresenceUpdates();
  }

  private loadFromLocalStorage(): void {
    const storedComments = localStorage.getItem('swaralipi_comments');
    if (storedComments) {
      try {
        const data = JSON.parse(storedComments);
        this.comments = new Map(Object.entries(data));
      } catch (error) {
        console.error('Error loading comments:', error);
      }
    }

    const storedLinks = localStorage.getItem('swaralipi_share_links');
    if (storedLinks) {
      try {
        const data = JSON.parse(storedLinks);
        this.shareLinks = new Map(Object.entries(data));
      } catch (error) {
        console.error('Error loading share links:', error);
      }
    }
  }

  private saveToLocalStorage(): void {
    localStorage.setItem('swaralipi_comments', JSON.stringify(Object.fromEntries(this.comments)));
    localStorage.setItem('swaralipi_share_links', JSON.stringify(Object.fromEntries(this.shareLinks)));
  }

  private startPresenceUpdates(): void {
    // Update presence every 5 seconds
    this.presenceUpdateInterval = setInterval(() => {
      this.updateOwnPresence();
    }, 5000);
  }

  setActiveComposition(compositionId: string): void {
    this.currentCompositionId = compositionId;
    this.loadComments(compositionId);
    this.loadCollaborators(compositionId);
  }

  // Comments
  private loadComments(compositionId: string): void {
    const comments = this.comments.get(compositionId) || [];
    this.commentsSubject.next(comments);
  }

  addComment(
    compositionId: string,
    text: string,
    cellPosition?: CellPosition,
    rowIndex?: number
  ): Comment {
    const user = this.authService.getCurrentUser();
    if (!user) {
      throw new Error('User must be authenticated to comment');
    }

    const comment: Comment = {
      id: this.generateId('comment'),
      compositionId,
      userId: user.id,
      userName: user.displayName,
      userPhoto: user.photoURL,
      text,
      cellPosition,
      rowIndex,
      createdAt: new Date(),
      updatedAt: new Date(),
      replies: [],
      resolved: false
    };

    const compositionComments = this.comments.get(compositionId) || [];
    compositionComments.push(comment);
    this.comments.set(compositionId, compositionComments);

    this.saveToLocalStorage();
    this.commentsSubject.next(compositionComments);

    return comment;
  }

  addReply(commentId: string, text: string): CommentReply {
    const user = this.authService.getCurrentUser();
    if (!user) {
      throw new Error('User must be authenticated to reply');
    }

    const reply: CommentReply = {
      id: this.generateId('reply'),
      userId: user.id,
      userName: user.displayName,
      userPhoto: user.photoURL,
      text,
      createdAt: new Date()
    };

    // Find comment and add reply
    for (const [compId, comments] of this.comments.entries()) {
      const comment = comments.find(c => c.id === commentId);
      if (comment) {
        comment.replies.push(reply);
        comment.updatedAt = new Date();
        this.saveToLocalStorage();
        this.commentsSubject.next(comments);
        return reply;
      }
    }

    throw new Error('Comment not found');
  }

  resolveComment(commentId: string): void {
    for (const [compId, comments] of this.comments.entries()) {
      const comment = comments.find(c => c.id === commentId);
      if (comment) {
        comment.resolved = true;
        comment.updatedAt = new Date();
        this.saveToLocalStorage();
        this.commentsSubject.next(comments);
        return;
      }
    }
  }

  deleteComment(commentId: string): void {
    for (const [compId, comments] of this.comments.entries()) {
      const index = comments.findIndex(c => c.id === commentId);
      if (index >= 0) {
        comments.splice(index, 1);
        this.saveToLocalStorage();
        this.commentsSubject.next(comments);
        return;
      }
    }
  }

  getCommentsForCell(row: number, col: number): Comment[] {
    if (!this.currentCompositionId) return [];

    const comments = this.comments.get(this.currentCompositionId) || [];
    return comments.filter(c =>
      c.cellPosition && c.cellPosition.row === row && c.cellPosition.col === col
    );
  }

  getCommentsForRow(rowIndex: number): Comment[] {
    if (!this.currentCompositionId) return [];

    const comments = this.comments.get(this.currentCompositionId) || [];
    return comments.filter(c => c.rowIndex === rowIndex);
  }

  getAllComments(): Comment[] {
    if (!this.currentCompositionId) return [];

    return this.comments.get(this.currentCompositionId) || [];
  }

  // Collaborator presence
  private loadCollaborators(compositionId: string): void {
    const collaborators = this.collaborators.get(compositionId) || [];
    this.collaboratorsSubject.next(collaborators);
  }

  updateOwnPresence(currentCell?: CellPosition): void {
    const user = this.authService.getCurrentUser();
    if (!user || !this.currentCompositionId) return;

    const collaborators = this.collaborators.get(this.currentCompositionId) || [];

    // Remove old presence
    const filtered = collaborators.filter(c => c.userId !== user.id);

    // Add updated presence
    filtered.push({
      userId: user.id,
      userName: user.displayName,
      userPhoto: user.photoURL,
      currentCell,
      color: this.getUserColor(user.id),
      lastActive: new Date()
    });

    this.collaborators.set(this.currentCompositionId, filtered);
    this.collaboratorsSubject.next(filtered);
  }

  private getUserColor(userId: string): string {
    // Generate consistent color for user
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
      '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'
    ];
    const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  }

  getActiveCollaborators(): CollaboratorPresence[] {
    if (!this.currentCompositionId) return [];

    const collaborators = this.collaborators.get(this.currentCompositionId) || [];
    const now = new Date().getTime();

    // Filter out inactive collaborators (> 30 seconds)
    return collaborators.filter(c => {
      const diff = now - c.lastActive.getTime();
      return diff < 30000;
    });
  }

  // Edit tracking
  trackEdit(
    action: EditAction['action'],
    cellPosition?: CellPosition,
    rowIndex?: number,
    before?: NotationCell,
    after?: NotationCell
  ): void {
    const user = this.authService.getCurrentUser();
    if (!user || !this.currentCompositionId) return;

    const editAction: EditAction = {
      id: this.generateId('edit'),
      userId: user.id,
      userName: user.displayName,
      action,
      cellPosition,
      rowIndex,
      before,
      after,
      timestamp: new Date()
    };

    const history = this.editHistory.get(this.currentCompositionId) || [];
    history.push(editAction);

    // Keep only last 100 actions
    if (history.length > 100) {
      history.shift();
    }

    this.editHistory.set(this.currentCompositionId, history);
    this.editActionsSubject.next(editAction);
  }

  getEditHistory(): EditAction[] {
    if (!this.currentCompositionId) return [];

    return this.editHistory.get(this.currentCompositionId) || [];
  }

  // Share links
  createShareLink(
    compositionId: string,
    accessLevel: ShareLink['accessLevel'],
    expiresInDays?: number,
    password?: string
  ): ShareLink {
    const user = this.authService.getCurrentUser();
    if (!user) {
      throw new Error('User must be authenticated');
    }

    const link: ShareLink = {
      id: this.generateId('link'),
      compositionId,
      createdBy: user.id,
      accessLevel,
      expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : undefined,
      password,
      enabled: true,
      createdAt: new Date(),
      accessCount: 0
    };

    this.shareLinks.set(link.id, link);
    this.saveToLocalStorage();

    return link;
  }

  getShareLink(linkId: string): ShareLink | undefined {
    return this.shareLinks.get(linkId);
  }

  getShareLinksForComposition(compositionId: string): ShareLink[] {
    return Array.from(this.shareLinks.values())
      .filter(link => link.compositionId === compositionId);
  }

  disableShareLink(linkId: string): void {
    const link = this.shareLinks.get(linkId);
    if (link) {
      link.enabled = false;
      this.saveToLocalStorage();
    }
  }

  validateShareLink(linkId: string, password?: string): boolean {
    const link = this.shareLinks.get(linkId);
    if (!link || !link.enabled) return false;

    if (link.expiresAt && new Date() > link.expiresAt) {
      return false;
    }

    if (link.password && link.password !== password) {
      return false;
    }

    link.accessCount++;
    this.saveToLocalStorage();

    return true;
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  ngOnDestroy(): void {
    if (this.presenceUpdateInterval) {
      clearInterval(this.presenceUpdateInterval);
    }
  }
}
