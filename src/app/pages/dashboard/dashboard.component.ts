import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { catchError, forkJoin, map, of, shareReplay } from 'rxjs';

import { DashboardService } from '../../core/api/dashboard.service';
import { ReadingProgressService } from '../../core/api/reading-progress.service';
import { DashboardSummary, ProgressBySeries, ReadingPlanItem, SeriesProgress } from '../../core/models/library.models';

@Component({
  selector: 'app-dashboard',
  imports: [AsyncPipe, DatePipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
  private readonly dashboardService = inject(DashboardService);
  private readonly progressService = inject(ReadingProgressService);

  readonly summary$ = forkJoin({
    summary: this.dashboardService.getSummary(),
    plan: this.progressService.getReadingPlan().pipe(catchError(() => of([])))
  }).pipe(
    map(({ summary, plan }) => this.enrichSummaryWithCovers(summary, plan)),
    shareReplay(1),
    catchError(() => of(null))
  );

  getCoverUrl(item: ReadingPlanItem | null | undefined): string | null {
    return item?.bookCoverUrl || item?.coverUrl || item?.cover_url || null;
  }

  getSeriesTrackId(series: ProgressBySeries | SeriesProgress): number {
    return 'seriesId' in series ? series.seriesId : series.id;
  }

  getSeriesName(series: ProgressBySeries | SeriesProgress): string {
    return 'seriesName' in series ? series.seriesName : series.name;
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

  private getBookTitle(item: ReadingPlanItem | null | undefined) {
    return item?.bookTitle || item?.book || '';
  }
}
