import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { NotationLayer, NotationCell, TaalStructure } from '../models/notation.model';

@Injectable({
  providedIn: 'root'
})
export class LayerManagerService {
  private layers: NotationLayer[] = [];
  private activeLayerId: string = '';

  private layersSubject = new BehaviorSubject<NotationLayer[]>([]);
  private activeLayerSubject = new BehaviorSubject<string>('');

  public layers$ = this.layersSubject.asObservable();
  public activeLayer$ = this.activeLayerSubject.asObservable();

  constructor() {
    this.initializeDefaultLayer();
  }

  private initializeDefaultLayer(): void {
    const defaultLayer: NotationLayer = {
      id: this.generateLayerId(),
      name: 'Vocal',
      type: 'vocal',
      visible: true,
      locked: false,
      cells: [],
      volume: 0.8,
      pan: 0
    };

    this.layers = [defaultLayer];
    this.activeLayerId = defaultLayer.id;
    this.layersSubject.next(this.layers);
    this.activeLayerSubject.next(this.activeLayerId);
  }

  private generateLayerId(): string {
    return `layer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  createLayer(
    name: string,
    type: NotationLayer['type'],
    cells: NotationCell[][] = []
  ): NotationLayer {
    const newLayer: NotationLayer = {
      id: this.generateLayerId(),
      name,
      type,
      visible: true,
      locked: false,
      cells,
      volume: 0.8,
      pan: 0
    };

    this.layers.push(newLayer);
    this.layersSubject.next(this.layers);
    return newLayer;
  }

  deleteLayer(layerId: string): boolean {
    if (this.layers.length <= 1) {
      return false; // Must have at least one layer
    }

    const index = this.layers.findIndex(l => l.id === layerId);
    if (index >= 0) {
      this.layers.splice(index, 1);

      // If deleted layer was active, switch to first layer
      if (this.activeLayerId === layerId) {
        this.activeLayerId = this.layers[0].id;
        this.activeLayerSubject.next(this.activeLayerId);
      }

      this.layersSubject.next(this.layers);
      return true;
    }
    return false;
  }

  getLayer(layerId: string): NotationLayer | undefined {
    return this.layers.find(l => l.id === layerId);
  }

  getActiveLayer(): NotationLayer | undefined {
    return this.getLayer(this.activeLayerId);
  }

  setActiveLayer(layerId: string): void {
    if (this.layers.find(l => l.id === layerId)) {
      this.activeLayerId = layerId;
      this.activeLayerSubject.next(this.activeLayerId);
    }
  }

  toggleLayerVisibility(layerId: string): void {
    const layer = this.getLayer(layerId);
    if (layer) {
      layer.visible = !layer.visible;
      this.layersSubject.next(this.layers);
    }
  }

  toggleLayerLock(layerId: string): void {
    const layer = this.getLayer(layerId);
    if (layer) {
      layer.locked = !layer.locked;
      this.layersSubject.next(this.layers);
    }
  }

  updateLayerName(layerId: string, name: string): void {
    const layer = this.getLayer(layerId);
    if (layer) {
      layer.name = name;
      this.layersSubject.next(this.layers);
    }
  }

  updateLayerVolume(layerId: string, volume: number): void {
    const layer = this.getLayer(layerId);
    if (layer) {
      layer.volume = Math.max(0, Math.min(1, volume));
      this.layersSubject.next(this.layers);
    }
  }

  updateLayerPan(layerId: string, pan: number): void {
    const layer = this.getLayer(layerId);
    if (layer) {
      layer.pan = Math.max(-1, Math.min(1, pan));
      this.layersSubject.next(this.layers);
    }
  }

  duplicateLayer(layerId: string): NotationLayer | null {
    const layer = this.getLayer(layerId);
    if (layer) {
      const duplicate: NotationLayer = {
        ...layer,
        id: this.generateLayerId(),
        name: `${layer.name} (Copy)`,
        cells: JSON.parse(JSON.stringify(layer.cells))
      };

      this.layers.push(duplicate);
      this.layersSubject.next(this.layers);
      return duplicate;
    }
    return null;
  }

  reorderLayers(fromIndex: number, toIndex: number): void {
    if (fromIndex >= 0 && fromIndex < this.layers.length &&
        toIndex >= 0 && toIndex < this.layers.length) {
      const [movedLayer] = this.layers.splice(fromIndex, 1);
      this.layers.splice(toIndex, 0, movedLayer);
      this.layersSubject.next(this.layers);
    }
  }

  getAllLayers(): NotationLayer[] {
    return [...this.layers];
  }

  getVisibleLayers(): NotationLayer[] {
    return this.layers.filter(l => l.visible);
  }

  mergeLayersDown(layerId: string): boolean {
    const index = this.layers.findIndex(l => l.id === layerId);
    if (index > 0) {
      const currentLayer = this.layers[index];
      const belowLayer = this.layers[index - 1];

      // Merge cells (non-empty cells from current layer override below layer)
      for (let row = 0; row < Math.min(currentLayer.cells.length, belowLayer.cells.length); row++) {
        for (let col = 0; col < Math.min(currentLayer.cells[row].length, belowLayer.cells[row].length); col++) {
          const currentCell = currentLayer.cells[row][col];
          if (currentCell.swar || currentCell.bol || currentCell.modifiers.length > 0) {
            belowLayer.cells[row][col] = { ...currentCell };
          }
        }
      }

      // Remove the current layer
      this.layers.splice(index, 1);

      if (this.activeLayerId === layerId) {
        this.activeLayerId = belowLayer.id;
        this.activeLayerSubject.next(this.activeLayerId);
      }

      this.layersSubject.next(this.layers);
      return true;
    }
    return false;
  }

  clearAllLayers(): void {
    this.layers = [];
    this.initializeDefaultLayer();
  }

  // Export/Import layer data
  exportLayersToJSON(): string {
    return JSON.stringify({
      layers: this.layers,
      activeLayerId: this.activeLayerId
    }, null, 2);
  }

  importLayersFromJSON(json: string): boolean {
    try {
      const data = JSON.parse(json);
      if (data.layers && Array.isArray(data.layers)) {
        this.layers = data.layers;
        this.activeLayerId = data.activeLayerId || this.layers[0].id;
        this.layersSubject.next(this.layers);
        this.activeLayerSubject.next(this.activeLayerId);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error importing layers:', error);
      return false;
    }
  }
}
