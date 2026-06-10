import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';

import { DashboardService } from '../../core/api/dashboard.service';
import { ReadingProgressService } from '../../core/api/reading-progress.service';
import { DashboardSummary, ProgressBySeries, ReadingPlanItem, SeriesProgress } from '../../core/models/library.models';

interface DashboardData {
  summary: DashboardSummary;
  plan: ReadingPlanItem[];
}

interface BookPlanGroup {
  bookId: number | null;
  bookTitle: string;
  coverUrl: string | null;
  totalChapters: number;
  completedChapters: number;
}

@Component({
  selector: 'app-dashboard',
  imports: [DatePipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
  private readonly dashboardService = inject(DashboardService);
  private readonly progressService = inject(ReadingProgressService);
  private readonly router = inject(Router);

  readonly data = signal<DashboardData | null>(null);
  readonly isLoading = signal(false);
  readonly errorMessage = signal('');
  readonly isMarkingRead = signal(false);
  readonly todayIso = this.toIsoDate(new Date());

  readonly summary = computed(() => this.data()?.summary ?? null);
  readonly plan = computed(() => this.data()?.plan ?? []);
  readonly currentBook = computed(() => this.getCurrentBookGroup());
  readonly planWindow = computed(() => this.getPlanWindow());
  readonly hasReadToday = computed(() => this.plan().some((item) => item.doneDate === this.todayIso));
  readonly todayScheduledItems = computed(() => this.plan().filter((item) => item.scheduledDate === this.todayIso));
  readonly isTodayPlanAlreadyDone = computed(() => {
    const items = this.todayScheduledItems();
    return items.length > 0 && items.every((item) => item.doneDate);
  });
  readonly plannedBooksCount = computed(() => new Set(this.plan().map((item) => this.getBookKey(item))).size);
  readonly plannedChaptersCount = computed(() => this.plan().length);
  readonly completedPlanChaptersCount = computed(() => this.plan().filter((item) => item.doneDate).length);

  constructor() {
    this.loadDashboard();
  }

  loadDashboard() {
    this.isLoading.set(true);
    this.errorMessage.set('');

    forkJoin({
      summary: this.dashboardService.getSummary(),
      plan: this.progressService.getReadingPlan().pipe(catchError(() => of([])))
    })
      .pipe(
        catchError(() => {
          this.errorMessage.set('Could not load dashboard.');
          return of(null);
        })
      )
      .subscribe((data) => {
        this.data.set(data ? {
          summary: this.enrichSummaryWithCovers(data.summary, data.plan),
          plan: data.plan
        } : null);
        this.isLoading.set(false);
      });
  }

  goToReadingPlan() {
    this.router.navigate(['/reading-plan']);
  }

  goToBookProgress() {
    this.router.navigate(['/book-progress']);
  }

  markTodayChapterRead() {
    const chapter = this.summary()?.todayPlannedChapter;

    if (!chapter || this.isMarkingRead()) {
      return;
    }

    this.isMarkingRead.set(true);
    this.progressService.markChapterRead(chapter.chapterId, this.todayIso).subscribe({
      next: () => {
        this.isMarkingRead.set(false);
        this.loadDashboard();
      },
      error: () => {
        this.isMarkingRead.set(false);
        this.errorMessage.set('Could not mark chapter as read.');
      }
    });
  }

  getCoverUrl(item: ReadingPlanItem | null | undefined): string | null {
    return item?.bookCoverUrl || item?.coverUrl || item?.cover_url || null;
  }

  getBookTitle(item: ReadingPlanItem | null | undefined) {
    return item?.bookTitle || item?.book || 'Untitled book';
  }

  getChapterTitle(item: ReadingPlanItem | null | undefined) {
    return item?.chapterTitle || item?.chapter || 'Untitled chapter';
  }

  getSeriesName(series: ProgressBySeries | SeriesProgress): string {
    return 'seriesName' in series ? series.seriesName : series.name;
  }

  getSeriesTrackId(series: ProgressBySeries | SeriesProgress): number {
    return 'seriesId' in series ? series.seriesId : series.id;
  }

  getCurrentBookProgress() {
    const currentBook = this.currentBook();

    if (!currentBook || currentBook.totalChapters === 0) {
      return 0;
    }

    return Math.round((currentBook.completedChapters / currentBook.totalChapters) * 100);
  }

  getStatusLabel(item: ReadingPlanItem) {
    return item.doneDate ? 'Read' : 'Planned';
  }

  getSeriesBarHeight(series: ProgressBySeries | SeriesProgress) {
    return Math.max(10, series.progressPercentage);
  }

  getPlanDisplayDate(item: ReadingPlanItem) {
    return item.scheduledDate || item.doneDate || '';
  }

  private getCurrentBookGroup(): BookPlanGroup | null {
    const current = this.summary()?.currentReadingChapter ?? this.summary()?.todayPlannedChapter;

    if (!current) {
      return null;
    }

    const currentKey = this.getBookKey(current);
    const items = this.plan().filter((item) => this.getBookKey(item) === currentKey);

    if (items.length === 0) {
      return {
        bookId: current.bookId ?? null,
        bookTitle: this.getBookTitle(current),
        coverUrl: this.getCoverUrl(current),
        totalChapters: 0,
        completedChapters: 0
      };
    }

    return {
      bookId: current.bookId ?? null,
      bookTitle: this.getBookTitle(current),
      coverUrl: this.getCoverUrl(current) || this.getCoverUrl(items[0]),
      totalChapters: items.length,
      completedChapters: items.filter((item) => item.doneDate).length
    };
  }

  private getPlanWindow() {
    const start = this.addDays(this.todayIso, -2);
    const end = this.addDays(this.todayIso, 2);

    return this.plan()
      .filter((item) => {
        const date = item.scheduledDate || item.doneDate;
        return Boolean(date && date >= start && date <= end);
      })
      .sort((first, second) =>
        String(first.scheduledDate ?? first.doneDate ?? '').localeCompare(String(second.scheduledDate ?? second.doneDate ?? ''))
      );
  }

  private enrichSummaryWithCovers(summary: DashboardSummary, plan: ReadingPlanItem[]): DashboardSummary {
    return {
      ...summary,
      currentReadingChapter: this.enrichItemWithCover(summary.currentReadingChapter, plan),
      todayPlannedChapter: this.enrichItemWithCover(summary.todayPlannedChapter, plan)
    };
  }

  private enrichItemWithCover(item: ReadingPlanItem | null | undefined, plan: ReadingPlanItem[]) {
    if (!item || this.getCoverUrl(item)) {
      return item ?? null;
    }

    const match = plan.find((planItem) => (
      (item.bookId && planItem.bookId === item.bookId) ||
      (this.getBookTitle(planItem) && this.getBookTitle(planItem) === this.getBookTitle(item))
    ));
    const coverUrl = this.getCoverUrl(match);

    return coverUrl ? { ...item, bookCoverUrl: coverUrl } : item;
  }

  private getBookKey(item: ReadingPlanItem) {
    return String(item.bookId ?? item.bookTitle ?? item.book ?? 'unknown');
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
