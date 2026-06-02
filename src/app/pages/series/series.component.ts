import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { SeriesService } from '../../core/api/series.service';
import { SeriesProgress } from '../../core/models/library.models';

interface SeriesView extends SeriesProgress {
  booksCount: number;
  completedBooksCount: number;
}

type ModalMode = 'create' | 'edit';

@Component({
  selector: 'app-series',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './series.component.html',
  styleUrl: './series.component.scss'
})
export class SeriesComponent {
  private readonly fb = inject(FormBuilder);
  private readonly seriesService = inject(SeriesService);

  readonly series = signal<SeriesView[]>([]);
  readonly searchTerm = signal('');
  readonly isLoading = signal(false);
  readonly errorMessage = signal('');
  readonly menuOpenId = signal<number | null>(null);
  readonly modalMode = signal<ModalMode>('create');
  readonly isEditorOpen = signal(false);
  readonly confirmDeleteSeries = signal<SeriesView | null>(null);
  readonly activeSeries = signal<SeriesView | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    coverUrl: ['']
  });

  readonly filteredSeries = computed(() => {
    const query = this.searchTerm().trim().toLowerCase();

    if (!query) {
      return this.series();
    }

    return this.series().filter((item) => item.name.toLowerCase().includes(query));
  });

  constructor() {
    this.loadSeries();
  }

  @HostListener('document:click')
  closeMenuOnOutsideClick() {
    this.menuOpenId.set(null);
  }

  loadSeries() {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.seriesService
      .getSeries()
      .pipe(
        catchError(() => {
          this.errorMessage.set('Could not load series. Check API URL and backend status.');
          return of([]);
        })
      )
      .subscribe((items) => {
        this.series.set(
          items.map((item) => ({
            ...item,
            booksCount: item.booksCount ?? 0,
            completedBooksCount: item.completedBooksCount ?? 0
          }))
        );
        this.isLoading.set(false);
      });
  }

  openCreateModal() {
    this.modalMode.set('create');
    this.activeSeries.set(null);
    this.form.reset();
    this.isEditorOpen.set(true);
    this.menuOpenId.set(null);
  }

  openEditModal(item: SeriesView) {
    this.modalMode.set('edit');
    this.activeSeries.set(item);
    this.form.setValue({
      name: item.name,
      coverUrl: item.coverUrl ?? ''
    });
    this.isEditorOpen.set(true);
    this.menuOpenId.set(null);
  }

  closeEditor() {
    this.isEditorOpen.set(false);
    this.form.reset();
  }

  saveSeries() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const payload = {
      name: value.name,
      coverUrl: value.coverUrl || null
    };
    const active = this.activeSeries();

    if (this.modalMode() === 'edit' && active) {
      this.seriesService.updateSeries(active.id, payload).subscribe({
        next: (updated) => {
          this.series.update((items) =>
            items.map((item) => (item.id === active.id ? { ...item, ...updated } : item))
          );
          this.closeEditor();
          this.loadSeries();
        },
        error: () => this.errorMessage.set('Could not update series.')
      });
      return;
    }

    this.seriesService.createSeries(payload).subscribe({
      next: (created) => {
        this.series.update((items) => [
          ...items,
          {
            ...created,
            totalChapters: created.totalChapters ?? 0,
            completedChapters: created.completedChapters ?? 0,
            progressPercentage: created.progressPercentage ?? 0,
            booksCount: 0,
            completedBooksCount: 0
          }
        ]);
        this.closeEditor();
        this.loadSeries();
      },
      error: () => this.errorMessage.set('Could not create series.')
    });
  }

  toggleMenu(id: number) {
    this.menuOpenId.update((openId) => (openId === id ? null : id));
  }

  askDelete(item: SeriesView) {
    this.confirmDeleteSeries.set(item);
    this.menuOpenId.set(null);
  }

  cancelDelete() {
    this.confirmDeleteSeries.set(null);
  }

  deleteSeries() {
    const item = this.confirmDeleteSeries();

    if (!item) {
      return;
    }

    this.seriesService.deleteSeries(item.id).subscribe({
      next: () => {
        this.series.update((items) => items.filter((seriesItem) => seriesItem.id !== item.id));
        this.confirmDeleteSeries.set(null);
      },
      error: () => this.errorMessage.set('Could not delete series.')
    });
  }
}
