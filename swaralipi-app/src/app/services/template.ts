import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { CompositionTemplate, NotationCell, CompositionMetadata, TAAL_STRUCTURES } from '../models/notation.model';

@Injectable({
  providedIn: 'root'
})
export class TemplateService {
  private templates: CompositionTemplate[] = [];
  private templatesSubject = new BehaviorSubject<CompositionTemplate[]>([]);

  public templates$ = this.templatesSubject.asObservable();

  constructor() {
    this.initializeDefaultTemplates();
  }

  private initializeDefaultTemplates(): void {
    // Teen Taal Bandish Template
    this.templates.push(this.createTeenTaalBandishTemplate());

    // Jhaptaal Taan Template
    this.templates.push(this.createJhaptaalTaanTemplate());

    // Rupak Taal Bhajan Template
    this.templates.push(this.createRupakBhajanTemplate());

    // Keherwa Ghazal Template
    this.templates.push(this.createKeherwaGhazalTemplate());

    this.templatesSubject.next(this.templates);
  }

  private createTeenTaalBandishTemplate(): CompositionTemplate {
    const rows = 4;
    const cols = 17; // 16 beats + 1 header
    const cells: NotationCell[][] = [];

    for (let i = 0; i < rows; i++) {
      const row: NotationCell[] = [];
      for (let j = 0; j < cols; j++) {
        row.push({
          swar: '',
          bol: j === 0 ? '' : (j === 1 ? 'धा' : (j === 5 ? 'धा' : (j === 9 ? 'ति' : (j === 13 ? 'ना' : '')))),
          modifiers: [],
          isHeader: j === 0
        });
      }
      cells.push(row);
    }

    return {
      id: 'template_teen_bandish',
      name: 'तीनताल बंदिश (Teen Taal Bandish)',
      description: 'Traditional 16-beat Teen Taal composition structure',
      category: 'bandish',
      taal: 'teen',
      grid: cells,
      metadata: {
        raga: 'भैरव',
        taal: 'teen',
        tempo: 60,
        title: 'नया बंदिश'
      },
      tags: ['traditional', 'classical', 'vocal']
    };
  }

  private createJhaptaalTaanTemplate(): CompositionTemplate {
    const rows = 8;
    const cols = 11; // 10 beats + 1 header
    const cells: NotationCell[][] = [];

    for (let i = 0; i < rows; i++) {
      const row: NotationCell[] = [];
      for (let j = 0; j < cols; j++) {
        row.push({
          swar: '',
          bol: '',
          modifiers: [],
          isHeader: j === 0
        });
      }
      cells.push(row);
    }

    return {
      id: 'template_jhaptaal_taan',
      name: 'झपताल तान (Jhaptaal Taan)',
      description: '10-beat Jhaptaal for fast improvisation patterns',
      category: 'taan',
      taal: 'jhaptaal',
      grid: cells,
      metadata: {
        raga: 'यमन',
        taal: 'jhaptaal',
        tempo: 180,
        title: 'तान प्रैक्टिस'
      },
      tags: ['taan', 'fast', 'improvisation']
    };
  }

  private createRupakBhajanTemplate(): CompositionTemplate {
    const rows = 6;
    const cols = 8; // 7 beats + 1 header
    const cells: NotationCell[][] = [];

    for (let i = 0; i < rows; i++) {
      const row: NotationCell[] = [];
      for (let j = 0; j < cols; j++) {
        row.push({
          swar: '',
          bol: '',
          modifiers: [],
          isHeader: j === 0
        });
      }
      cells.push(row);
    }

    return {
      id: 'template_rupak_bhajan',
      name: 'रूपक भजन (Rupak Bhajan)',
      description: '7-beat Rupak Taal for devotional songs',
      category: 'bhajan',
      taal: 'rupak',
      grid: cells,
      metadata: {
        raga: '',
        taal: 'rupak',
        tempo: 90,
        title: 'भजन'
      },
      tags: ['bhajan', 'devotional', 'medium tempo']
    };
  }

  private createKeherwaGhazalTemplate(): CompositionTemplate {
    const rows = 8;
    const cols = 9; // 8 beats + 1 header
    const cells: NotationCell[][] = [];

    for (let i = 0; i < rows; i++) {
      const row: NotationCell[] = [];
      for (let j = 0; j < cols; j++) {
        row.push({
          swar: '',
          bol: j === 0 ? '' : (j === 1 ? 'धा' : (j === 5 ? 'गे' : '')),
          modifiers: [],
          isHeader: j === 0
        });
      }
      cells.push(row);
    }

    return {
      id: 'template_keherwa_ghazal',
      name: 'कहरवा गज़ल (Keherwa Ghazal)',
      description: '8-beat Keherwa pattern for Ghazals',
      category: 'ghazal',
      taal: 'keherwa',
      grid: cells,
      metadata: {
        raga: '',
        taal: 'keherwa',
        tempo: 100,
        title: 'नई गज़ल'
      },
      tags: ['ghazal', 'urdu', 'light classical']
    };
  }

  getAllTemplates(): CompositionTemplate[] {
    return [...this.templates];
  }

  getTemplatesByCategory(category: CompositionTemplate['category']): CompositionTemplate[] {
    return this.templates.filter(t => t.category === category);
  }

  getTemplateById(id: string): CompositionTemplate | undefined {
    return this.templates.find(t => t.id === id);
  }

  searchTemplates(query: string): CompositionTemplate[] {
    const lowerQuery = query.toLowerCase();
    return this.templates.filter(t =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.description.toLowerCase().includes(lowerQuery) ||
      t.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
      t.category.toLowerCase().includes(lowerQuery)
    );
  }

  createCustomTemplate(
    name: string,
    description: string,
    category: CompositionTemplate['category'],
    grid: NotationCell[][],
    metadata: CompositionMetadata,
    tags: string[] = []
  ): CompositionTemplate {
    const template: CompositionTemplate = {
      id: `template_custom_${Date.now()}`,
      name,
      description,
      category,
      taal: metadata.taal,
      raga: metadata.raga,
      grid: JSON.parse(JSON.stringify(grid)), // Deep copy
      metadata: { ...metadata },
      tags
    };

    this.templates.push(template);
    this.templatesSubject.next(this.templates);
    return template;
  }

  deleteTemplate(id: string): boolean {
    const index = this.templates.findIndex(t => t.id === id);
    if (index >= 0 && id.startsWith('template_custom_')) {
      this.templates.splice(index, 1);
      this.templatesSubject.next(this.templates);
      return true;
    }
    return false; // Cannot delete built-in templates
  }

  updateTemplate(id: string, updates: Partial<CompositionTemplate>): boolean {
    const template = this.getTemplateById(id);
    if (template && id.startsWith('template_custom_')) {
      Object.assign(template, updates);
      this.templatesSubject.next(this.templates);
      return true;
    }
    return false;
  }

  exportTemplatesToJSON(): string {
    const customTemplates = this.templates.filter(t => t.id.startsWith('template_custom_'));
    return JSON.stringify(customTemplates, null, 2);
  }

  importTemplatesFromJSON(json: string): boolean {
    try {
      const imported: CompositionTemplate[] = JSON.parse(json);
      if (Array.isArray(imported)) {
        imported.forEach(template => {
          // Ensure unique IDs
          if (!this.templates.find(t => t.id === template.id)) {
            this.templates.push(template);
          }
        });
        this.templatesSubject.next(this.templates);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error importing templates:', error);
      return false;
    }
  }

  cloneTemplate(id: string, newName?: string): CompositionTemplate | null {
    const template = this.getTemplateById(id);
    if (template) {
      const clone = JSON.parse(JSON.stringify(template));
      clone.id = `template_custom_${Date.now()}`;
      clone.name = newName || `${template.name} (Copy)`;
      this.templates.push(clone);
      this.templatesSubject.next(this.templates);
      return clone;
    }
    return null;
  }

  getTemplatesByTaal(taal: string): CompositionTemplate[] {
    return this.templates.filter(t => t.taal === taal);
  }

  getTemplatesByRaga(raga: string): CompositionTemplate[] {
    return this.templates.filter(t => t.raga?.toLowerCase() === raga.toLowerCase());
  }
}
