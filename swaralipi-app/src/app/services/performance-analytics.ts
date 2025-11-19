import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { NotationGrid, CellPosition } from '../models/notation.model';

export interface PerformanceMetrics {
  accuracy: number; // 0-100
  timing: number; // 0-100
  consistency: number; // 0-100
  complexity: number; // 0-100
  overallScore: number; // 0-100
}

export interface HeatmapData {
  cellPosition: CellPosition;
  playCount: number;
  mistakeCount: number;
  averageAccuracy: number;
}

export interface ProgressData {
  date: Date;
  score: number;
  duration: number; // minutes
  compositionId: string;
}

export interface PracticeInsight {
  type: 'improvement' | 'struggle' | 'mastered' | 'needsPractice';
  message: string;
  data?: any;
  priority: 'high' | 'medium' | 'low';
}

export interface CompositionDifficulty {
  overall: number; // 0-100
  factors: {
    tempoComplexity: number;
    rhythmicComplexity: number;
    melodicComplexity: number;
    ornamentationComplexity: number;
    lengthComplexity: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class PerformanceAnalyticsService {
  private playHistory: Map<string, HeatmapData[]> = new Map();
  private progressHistory: ProgressData[] = [];
  private performanceMetrics: Map<string, PerformanceMetrics> = new Map();

  private insightsSubject = new BehaviorSubject<PracticeInsight[]>([]);
  public insights$ = this.insightsSubject.asObservable();

  constructor() {
    this.loadFromLocalStorage();
    this.generateInsights();
  }

  private loadFromLocalStorage(): void {
    const storedHistory = localStorage.getItem('swaralipi_play_history');
    if (storedHistory) {
      try {
        const data = JSON.parse(storedHistory);
        this.playHistory = new Map(Object.entries(data));
      } catch (error) {
        console.error('Error loading play history:', error);
      }
    }

    const storedProgress = localStorage.getItem('swaralipi_progress');
    if (storedProgress) {
      try {
        this.progressHistory = JSON.parse(storedProgress);
      } catch (error) {
        console.error('Error loading progress:', error);
      }
    }

    const storedMetrics = localStorage.getItem('swaralipi_metrics');
    if (storedMetrics) {
      try {
        const data = JSON.parse(storedMetrics);
        this.performanceMetrics = new Map(Object.entries(data));
      } catch (error) {
        console.error('Error loading metrics:', error);
      }
    }
  }

  private saveToLocalStorage(): void {
    localStorage.setItem('swaralipi_play_history', JSON.stringify(Object.fromEntries(this.playHistory)));
    localStorage.setItem('swaralipi_progress', JSON.stringify(this.progressHistory));
    localStorage.setItem('swaralipi_metrics', JSON.stringify(Object.fromEntries(this.performanceMetrics)));
  }

  // Track play events
  trackCellPlay(
    compositionId: string,
    cellPosition: CellPosition,
    wasCorrect: boolean = true
  ): void {
    const heatmap = this.playHistory.get(compositionId) || [];

    let cellData = heatmap.find(
      h => h.cellPosition.row === cellPosition.row && h.cellPosition.col === cellPosition.col
    );

    if (!cellData) {
      cellData = {
        cellPosition,
        playCount: 0,
        mistakeCount: 0,
        averageAccuracy: 100
      };
      heatmap.push(cellData);
    }

    cellData.playCount++;
    if (!wasCorrect) {
      cellData.mistakeCount++;
    }

    // Recalculate average accuracy
    cellData.averageAccuracy = ((cellData.playCount - cellData.mistakeCount) / cellData.playCount) * 100;

    this.playHistory.set(compositionId, heatmap);
    this.saveToLocalStorage();
  }

  // Get heatmap data for visualization
  getHeatmapData(compositionId: string): HeatmapData[] {
    return this.playHistory.get(compositionId) || [];
  }

  // Get cells that need more practice
  getCellsNeedingPractice(compositionId: string, threshold: number = 70): HeatmapData[] {
    const heatmap = this.getHeatmapData(compositionId);
    return heatmap
      .filter(cell => cell.averageAccuracy < threshold && cell.playCount > 3)
      .sort((a, b) => a.averageAccuracy - b.averageAccuracy);
  }

  // Record practice session result
  recordPracticeSession(
    compositionId: string,
    score: number,
    duration: number
  ): void {
    this.progressHistory.push({
      date: new Date(),
      score,
      duration,
      compositionId
    });

    // Keep only last 100 sessions
    if (this.progressHistory.length > 100) {
      this.progressHistory.shift();
    }

    this.saveToLocalStorage();
    this.generateInsights();
  }

  // Get progress over time
  getProgressData(compositionId?: string, days: number = 30): ProgressData[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    let data = this.progressHistory.filter(p => new Date(p.date) >= cutoffDate);

    if (compositionId) {
      data = data.filter(p => p.compositionId === compositionId);
    }

    return data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  // Calculate performance metrics
  calculatePerformanceMetrics(
    compositionId: string,
    grid: NotationGrid
  ): PerformanceMetrics {
    const heatmap = this.getHeatmapData(compositionId);
    const progressData = this.getProgressData(compositionId, 30);

    // Calculate accuracy
    const totalPlays = heatmap.reduce((sum, cell) => sum + cell.playCount, 0);
    const totalMistakes = heatmap.reduce((sum, cell) => sum + cell.mistakeCount, 0);
    const accuracy = totalPlays > 0 ? ((totalPlays - totalMistakes) / totalPlays) * 100 : 100;

    // Calculate timing consistency
    const timing = this.calculateTimingScore(progressData);

    // Calculate consistency (variance in scores)
    const consistency = this.calculateConsistencyScore(progressData);

    // Calculate complexity handled
    const complexity = this.analyzeCompositionDifficulty(grid).overall;

    // Overall score
    const overallScore = (accuracy * 0.4) + (timing * 0.2) + (consistency * 0.2) + (complexity * 0.2);

    const metrics: PerformanceMetrics = {
      accuracy,
      timing,
      consistency,
      complexity,
      overallScore
    };

    this.performanceMetrics.set(compositionId, metrics);
    this.saveToLocalStorage();

    return metrics;
  }

  private calculateTimingScore(progressData: ProgressData[]): number {
    if (progressData.length < 2) return 100;

    // Analyze score improvements over time
    const recentScores = progressData.slice(-5).map(p => p.score);
    const averageRecent = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;

    return Math.min(100, averageRecent);
  }

  private calculateConsistencyScore(progressData: ProgressData[]): number {
    if (progressData.length < 3) return 100;

    const scores = progressData.map(p => p.score);
    const average = scores.reduce((a, b) => a + b, 0) / scores.length;

    // Calculate variance
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - average, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);

    // Lower variance = higher consistency
    // Normalize to 0-100 scale
    const consistencyScore = Math.max(0, 100 - (stdDev * 2));

    return consistencyScore;
  }

  // Analyze composition difficulty
  analyzeCompositionDifficulty(grid: NotationGrid): CompositionDifficulty {
    const tempoComplexity = this.analyzeTempoComplexity(grid.metadata.tempo);
    const rhythmicComplexity = this.analyzeRhythmicComplexity(grid);
    const melodicComplexity = this.analyzeMelodicComplexity(grid);
    const ornamentationComplexity = this.analyzeOrnamentationComplexity(grid);
    const lengthComplexity = this.analyzeLengthComplexity(grid);

    const overall = (
      tempoComplexity * 0.2 +
      rhythmicComplexity * 0.25 +
      melodicComplexity * 0.25 +
      ornamentationComplexity * 0.15 +
      lengthComplexity * 0.15
    );

    return {
      overall,
      factors: {
        tempoComplexity,
        rhythmicComplexity,
        melodicComplexity,
        ornamentationComplexity,
        lengthComplexity
      }
    };
  }

  private analyzeTempoComplexity(tempo: number): number {
    // Slower = easier, faster = harder
    if (tempo < 60) return 20;
    if (tempo < 90) return 40;
    if (tempo < 120) return 60;
    if (tempo < 160) return 80;
    return 100;
  }

  private analyzeRhythmicComplexity(grid: NotationGrid): number {
    let complexity = 0;
    let totalCells = 0;

    // Analyze tabla patterns
    for (const row of grid.cells) {
      for (let col = 1; col < row.length; col++) {
        const cell = row[col];
        if (cell.bol) {
          totalCells++;

          // Complex bols increase difficulty
          if (cell.bol.length > 2) {
            complexity += 2;
          } else {
            complexity += 1;
          }
        }
      }
    }

    return totalCells > 0 ? Math.min(100, (complexity / totalCells) * 50) : 50;
  }

  private analyzeMelodicComplexity(grid: NotationGrid): number {
    let complexity = 0;
    let totalSwars = 0;
    let previousSwar: string | null = null;

    for (const row of grid.cells) {
      for (let col = 1; col < row.length; col++) {
        const cell = row[col];
        if (cell.swar && cell.swar !== '-' && cell.swar !== ',') {
          totalSwars++;

          // Large jumps increase complexity
          if (previousSwar && previousSwar !== cell.swar) {
            complexity += 1;
          }

          previousSwar = cell.swar;
        }
      }
    }

    return totalSwars > 0 ? Math.min(100, (complexity / totalSwars) * 100) : 50;
  }

  private analyzeOrnamentationComplexity(grid: NotationGrid): number {
    let ornamentCount = 0;
    let totalCells = 0;

    for (const row of grid.cells) {
      for (let col = 1; col < row.length; col++) {
        const cell = row[col];
        if (cell.swar || cell.bol) {
          totalCells++;
          ornamentCount += cell.modifiers.length;
        }
      }
    }

    return totalCells > 0 ? Math.min(100, (ornamentCount / totalCells) * 100) : 0;
  }

  private analyzeLengthComplexity(grid: NotationGrid): number {
    const totalBeats = grid.rows * (grid.cols - 1);

    if (totalBeats < 32) return 20;
    if (totalBeats < 64) return 40;
    if (totalBeats < 128) return 60;
    if (totalBeats < 256) return 80;
    return 100;
  }

  // Generate practice insights
  private generateInsights(): void {
    const insights: PracticeInsight[] = [];

    // Analyze recent progress
    const recentProgress = this.getProgressData(undefined, 7);

    if (recentProgress.length > 0) {
      const averageScore = recentProgress.reduce((sum, p) => sum + p.score, 0) / recentProgress.length;

      if (averageScore > 90) {
        insights.push({
          type: 'mastered',
          message: 'Excellent progress! Your average score this week is above 90%',
          priority: 'low'
        });
      } else if (averageScore < 60) {
        insights.push({
          type: 'needsPractice',
          message: 'Consider slowing down the tempo and practicing difficult sections separately',
          priority: 'high'
        });
      }

      // Check for improvement trend
      if (recentProgress.length >= 5) {
        const firstHalf = recentProgress.slice(0, Math.floor(recentProgress.length / 2));
        const secondHalf = recentProgress.slice(Math.floor(recentProgress.length / 2));

        const firstAvg = firstHalf.reduce((sum, p) => sum + p.score, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, p) => sum + p.score, 0) / secondHalf.length;

        if (secondAvg > firstAvg + 10) {
          insights.push({
            type: 'improvement',
            message: `Great improvement! Your scores have increased by ${Math.round(secondAvg - firstAvg)}%`,
            priority: 'medium'
          });
        } else if (firstAvg > secondAvg + 10) {
          insights.push({
            type: 'struggle',
            message: 'Your scores are declining. Try taking a break and coming back refreshed',
            priority: 'high'
          });
        }
      }
    }

    // Check practice frequency
    const lastWeekSessions = recentProgress.length;
    if (lastWeekSessions === 0) {
      insights.push({
        type: 'needsPractice',
        message: 'No practice sessions this week. Consistent practice leads to better results',
        priority: 'high'
      });
    } else if (lastWeekSessions >= 5) {
      insights.push({
        type: 'improvement',
        message: `Excellent consistency! You practiced ${lastWeekSessions} times this week`,
        priority: 'low'
      });
    }

    this.insightsSubject.next(insights);
  }

  getInsights(): PracticeInsight[] {
    return this.insightsSubject.value;
  }

  // Get statistics
  getStatistics(compositionId?: string): {
    totalPracticeTime: number; // minutes
    totalSessions: number;
    averageScore: number;
    bestScore: number;
    currentStreak: number; // days
    longestStreak: number; // days
  } {
    const data = compositionId
      ? this.progressHistory.filter(p => p.compositionId === compositionId)
      : this.progressHistory;

    const totalPracticeTime = data.reduce((sum, p) => sum + p.duration, 0);
    const totalSessions = data.length;
    const averageScore = totalSessions > 0
      ? data.reduce((sum, p) => sum + p.score, 0) / totalSessions
      : 0;
    const bestScore = totalSessions > 0
      ? Math.max(...data.map(p => p.score))
      : 0;

    // Calculate streaks
    const { current, longest } = this.calculateStreaks(data);

    return {
      totalPracticeTime,
      totalSessions,
      averageScore,
      bestScore,
      currentStreak: current,
      longestStreak: longest
    };
  }

  private calculateStreaks(data: ProgressData[]): { current: number; longest: number } {
    if (data.length === 0) return { current: 0, longest: 0 };

    const sortedData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let currentStreak = 1;
    let longestStreak = 1;
    let tempStreak = 1;

    for (let i = 1; i < sortedData.length; i++) {
      const prevDate = new Date(sortedData[i - 1].date);
      const currDate = new Date(sortedData[i].date);

      const dayDiff = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

      if (dayDiff === 1) {
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else if (dayDiff > 1) {
        tempStreak = 1;
      }
    }

    // Check if last practice was today or yesterday
    const lastPractice = new Date(sortedData[sortedData.length - 1].date);
    const today = new Date();
    const daysSinceLastPractice = Math.floor((today.getTime() - lastPractice.getTime()) / (1000 * 60 * 60 * 24));

    currentStreak = daysSinceLastPractice <= 1 ? tempStreak : 0;

    return { current: currentStreak, longest: longestStreak };
  }

  // Export analytics data
  exportAnalyticsData(): string {
    return JSON.stringify({
      playHistory: Object.fromEntries(this.playHistory),
      progressHistory: this.progressHistory,
      performanceMetrics: Object.fromEntries(this.performanceMetrics)
    }, null, 2);
  }

  // Clear analytics data
  clearAnalyticsData(compositionId?: string): void {
    if (compositionId) {
      this.playHistory.delete(compositionId);
      this.performanceMetrics.delete(compositionId);
      this.progressHistory = this.progressHistory.filter(p => p.compositionId !== compositionId);
    } else {
      this.playHistory.clear();
      this.performanceMetrics.clear();
      this.progressHistory = [];
    }

    this.saveToLocalStorage();
    this.generateInsights();
  }
}
