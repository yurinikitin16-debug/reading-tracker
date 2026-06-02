import { DatePipe } from '@angular/common';
import { Component, ElementRef, ViewChild, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, of } from 'rxjs';

import { ChaptersService } from '../../core/api/chapters.service';
import { ReadingProgressService } from '../../core/api/reading-progress.service';
import { SeriesService } from '../../core/api/series.service';
import { BookProgress, Chapter, ReadingPlanItem, SeriesDetails, SeriesProgress } from '../../core/models/library.models';

interface PlanBookGroup {
  key: string;
  bookId: number | null;
  seriesName: string;
  bookTitle: string;
  bookCoverUrl?: string | null;
  startDate: string | null;
  endDate: string | null;
  totalChapters: number;
  completedChapters: number;
  items: ReadingPlanItem[];
}

interface PreviewChapter {
  chapterOrder: number;
  title: string;
  pages?: number | null;
  date: string;
}

@Component({
  selector: 'app-reading-plan',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './reading-plan.component.html',
  styleUrl: './reading-plan.component.scss'
})
export class ReadingPlanComponent {
  @ViewChild('doneDateInput') private doneDateInput?: ElementRef<HTMLInputElement>;

  private readonly fb = inject(FormBuilder);
  private readonly chaptersService = inject(ChaptersService);
  private readonly progressService = inject(ReadingProgressService);
  private readonly seriesService = inject(SeriesService);

  readonly plan = signal<ReadingPlanItem[]>([]);
  readonly series = signal<SeriesProgress[]>([]);
  readonly selectedSeriesDetails = signal<SeriesDetails | null>(null);
  readonly selectedBookChapters = signal<Chapter[]>([]);
  readonly isLoadingPlan = signal(false);
  readonly isLoadingSeries = signal(false);
  readonly isLoadingBooks = signal(false);
  readonly isLoadingChapters = signal(false);
  readonly isAddingPlan = signal(false);
  readonly isAddPlanOpen = signal(false);
  readonly isMarkReadOpen = signal(false);
  readonly errorMessage = signal('');
  readonly collapsedGroups = signal<Set<string>>(new Set());
  readonly activeReadItem = signal<ReadingPlanItem | null>(null);

  readonly addPlanForm = this.fb.nonNullable.group({
    seriesId: [0, [Validators.required, Validators.min(1)]],
    bookId: [0, [Validators.required, Validators.min(1)]],
    startDate: [this.toIsoDate(new Date()), Validators.required]
  });

  readonly markReadForm = this.fb.nonNullable.group({
    doneDate: [this.toIsoDate(new Date()), Validators.required]
  });

  readonly availableBooks = computed(() => this.selectedSeriesDetails()?.books ?? []);

  readonly selectedBook = computed(() => {
    const bookId = this.addPlanForm.controls.bookId.value;
    return this.availableBooks().find((book) => book.id === bookId) ?? null;
  });

  readonly previewChapters = computed<PreviewChapter[]>(() => {
    const startDate = this.addPlanForm.controls.startDate.value;

    if (!startDate) {
      return [];
    }

    return this.selectedBookChapters()
      .slice()
      .sort((first, second) => first.chapterOrder - second.chapterOrder)
      .map((chapter, index) => ({
        chapterOrder: chapter.chapterOrder,
        title: chapter.title,
        pages: chapter.pages,
        date: this.addDays(startDate, index)
      }));
  });

  readonly planGroups = computed(() => this.groupPlan(this.plan()));

  constructor() {
    this.loadPlan();
    this.loadSeries();
  }

  loadPlan() {
    this.isLoadingPlan.set(true);
    this.errorMessage.set('');

    this.progressService
      .getReadingPlan()
      .pipe(
        catchError(() => {
          this.errorMessage.set('Could not load reading plan.');
          return of([]);
        })
      )
      .subscribe((items) => {
        this.plan.set(items);
        this.resetCollapsedGroups(items);
        this.isLoadingPlan.set(false);
      });
  }

  loadSeries() {
    this.isLoadingSeries.set(true);

    this.seriesService
      .getSeries()
      .pipe(catchError(() => of([])))
      .subscribe((items) => {
        this.series.set(items);
        this.isLoadingSeries.set(false);
      });
  }

  openAddPlanModal() {
    this.isAddPlanOpen.set(true);
    this.errorMessage.set('');

    this.progressService
      .getNextPlanDate()
      .pipe(catchError(() => of({ nextDate: this.getSuggestedStartDate() })))
      .subscribe(({ nextDate }) => {
        this.addPlanForm.patchValue({ startDate: nextDate || this.getSuggestedStartDate() });

        const firstSeriesId = this.series()[0]?.id ?? 0;
        if (firstSeriesId) {
          this.selectSeriesForPlan(firstSeriesId);
        }
      });
  }

  closeAddPlanModal() {
    this.isAddPlanOpen.set(false);
    this.selectedSeriesDetails.set(null);
    this.selectedBookChapters.set([]);
    this.addPlanForm.reset({
      seriesId: 0,
      bookId: 0,
      startDate: this.toIsoDate(new Date())
    });
  }

  selectSeriesByValue(value: string) {
    this.selectSeriesForPlan(Number(value));
  }

  selectBookByValue(value: string) {
    this.selectBookForPlan(Number(value));
  }

  selectSeriesForPlan(seriesId: number) {
    if (!Number.isFinite(seriesId) || seriesId < 1) {
      return;
    }

    this.isLoadingBooks.set(true);
    this.selectedBookChapters.set([]);
    this.addPlanForm.patchValue({ seriesId, bookId: 0 });

    this.seriesService
      .getSeriesDetails(seriesId)
      .pipe(
        catchError(() => {
          this.errorMessage.set('Could not load books for selected series.');
          return of(null);
        })
      )
      .subscribe((details) => {
        this.selectedSeriesDetails.set(details);
        this.isLoadingBooks.set(false);

        const firstBook = details?.books[0];
        if (firstBook) {
          this.selectBookForPlan(firstBook.id);
        }
      });
  }

  selectBookForPlan(bookId: number) {
    if (!Number.isFinite(bookId) || bookId < 1) {
      return;
    }

    this.addPlanForm.patchValue({ bookId });
    this.isLoadingChapters.set(true);

    this.chaptersService
      .getChaptersByBook(bookId)
      .pipe(
        catchError(() => {
          this.errorMessage.set('Could not load chapters for selected book.');
          return of([]);
        })
      )
      .subscribe((chapters) => {
        this.selectedBookChapters.set(chapters);
        this.isLoadingChapters.set(false);
      });
  }

  addBookToPlan() {
    if (this.addPlanForm.invalid || this.previewChapters().length === 0 || this.isAddingPlan()) {
      this.addPlanForm.markAllAsTouched();
      return;
    }

    const value = this.addPlanForm.getRawValue();
    this.isAddingPlan.set(true);

    this.progressService
      .addBookToPlan({
        bookId: value.bookId,
        startDate: value.startDate
      })
      .subscribe({
        next: () => {
          this.isAddingPlan.set(false);
          this.closeAddPlanModal();
          this.loadPlan();
        },
        error: () => {
          this.isAddingPlan.set(false);
          this.errorMessage.set('Could not add book to plan.');
        }
      });
  }

  openMarkReadModal(item: ReadingPlanItem) {
    const suggestedDoneDate = this.getSuggestedDoneDate();

    this.activeReadItem.set(item);
    this.isMarkReadOpen.set(true);
    this.markReadForm.controls.doneDate.setValue(suggestedDoneDate);
    queueMicrotask(() => {
      this.markReadForm.controls.doneDate.setValue(suggestedDoneDate);
      this.doneDateInput?.nativeElement.focus();
    });
  }

  closeMarkReadModal() {
    this.isMarkReadOpen.set(false);
    this.activeReadItem.set(null);
    this.markReadForm.reset({ doneDate: this.toIsoDate(new Date()) });
  }

  markRead() {
    const item = this.activeReadItem();

    if (!item || this.markReadForm.invalid) {
      this.markReadForm.markAllAsTouched();
      return;
    }

    this.progressService.markChapterRead(item.chapterId, this.markReadForm.controls.doneDate.value).subscribe({
      next: () => {
        this.closeMarkReadModal();
        this.loadPlan();
      },
      error: () => this.errorMessage.set('Could not mark chapter as read.')
    });
  }

  unmarkRead(chapterId: number) {
    this.progressService.unmarkChapterRead(chapterId).subscribe(() => this.loadPlan());
  }

  isGroupCollapsed(key: string) {
    return this.collapsedGroups().has(key);
  }

  toggleGroup(key: string) {
    this.collapsedGroups.update((current) => {
      const next = new Set(current);

      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }

      return next;
    });
  }

  private groupPlan(items: ReadingPlanItem[]): PlanBookGroup[] {
    const groups = new Map<string, ReadingPlanItem[]>();

    items
      .slice()
      .sort((first, second) => String(first.scheduledDate ?? '').localeCompare(String(second.scheduledDate ?? '')))
      .forEach((item) => {
        const key = String(item.bookId ?? item.bookTitle ?? item.book ?? 'unknown');
        groups.set(key, [...(groups.get(key) ?? []), item]);
      });

    return Array.from(groups.entries())
      .map(([key, groupItems]) => {
        const first = groupItems[0];
        const completedChapters = groupItems.filter((item) => item.doneDate).length;
        const displayItems = groupItems.slice().sort((firstItem, secondItem) => {
          const completionSort = Number(Boolean(firstItem.doneDate)) - Number(Boolean(secondItem.doneDate));

          if (completionSort !== 0) {
            return completionSort;
          }

          return String(firstItem.scheduledDate ?? '').localeCompare(String(secondItem.scheduledDate ?? ''));
        });

        return {
          key,
          bookId: first.bookId ?? null,
        seriesName: first.seriesName || first.series || '-',
        bookTitle: first.bookTitle || first.book || 'Untitled book',
        bookCoverUrl: first.bookCoverUrl || first.coverUrl || first.cover_url,
        startDate: groupItems[0]?.scheduledDate ?? null,
          endDate: groupItems[groupItems.length - 1]?.scheduledDate ?? null,
          totalChapters: groupItems.length,
          completedChapters,
          items: displayItems
        };
      })
      .sort((firstGroup, secondGroup) =>
        String(secondGroup.startDate ?? '').localeCompare(String(firstGroup.startDate ?? ''))
      );
  }

  private resetCollapsedGroups(items: ReadingPlanItem[]) {
    const groups = this.groupPlan(items);
    const openKey =
      groups.find((group) => group.completedChapters < group.totalChapters)?.key ?? groups[0]?.key;

    this.collapsedGroups.set(new Set(groups.filter((group) => group.key !== openKey).map((group) => group.key)));
  }

  private getSuggestedStartDate() {
    const scheduledDates = this.plan()
      .map((item) => item.scheduledDate)
      .filter((date): date is string => Boolean(date))
      .sort();

    if (scheduledDates.length === 0) {
      return this.toIsoDate(new Date());
    }

    return this.addDays(scheduledDates[scheduledDates.length - 1], 1);
  }

  private getSuggestedDoneDate() {
    const today = this.toIsoDate(new Date());
    const doneDates = this.plan()
      .map((item) => item.doneDate)
      .filter((date): date is string => Boolean(date))
      .sort();

    if (doneDates.length === 0) {
      return today;
    }

    const latestDoneDate = doneDates[doneDates.length - 1];

    return latestDoneDate === today ? today : this.addDays(latestDoneDate, 1);
  }

  private addDays(isoDate: string, days: number) {
    const [year, month, day] = isoDate.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + days));
    return date.toISOString().slice(0, 10);
  }

  private toIsoDate(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}
