import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, of } from 'rxjs';

import { ReadingProgressService } from '../../core/api/reading-progress.service';
import { CalendarDay, ReadingPlanItem } from '../../core/models/library.models';

interface CalendarCell {
  date: Date;
  isoDate: string;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  completedChapters: number;
  plannedChapters: number;
  openPlannedChapters: number;
  alreadyDoneChapters: number;
  missedChapters: number;
}

@Component({
  selector: 'app-calendar',
  imports: [DatePipe],
  templateUrl: './calendar.component.html',
  styleUrl: './calendar.component.scss'
})
export class CalendarComponent {
  private readonly progressService = inject(ReadingProgressService);
  private readonly router = inject(Router);
  private readonly todayIso = this.toIsoDate(new Date());

  readonly weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  readonly currentMonth = signal(this.startOfMonth(new Date()));
  readonly calendarDays = signal<CalendarDay[]>([]);
  readonly selectedDate = signal(this.todayIso);
  readonly isLoading = signal(false);
  readonly errorMessage = signal('');
  readonly rescheduleItem = signal<ReadingPlanItem | null>(null);
  readonly rescheduleDate = signal('');
  readonly isSavingAction = signal(false);

  readonly monthLabel = computed(() => this.currentMonth());
  readonly calendarByDate = computed(() => new Map(this.calendarDays().map((day) => [day.date, day])));
  readonly selectedDay = computed(() => this.calendarByDate().get(this.selectedDate()) ?? this.emptyDay(this.selectedDate()));
  readonly selectedScheduled = computed(() => this.selectedDay().scheduled ?? []);
  readonly selectedCompleted = computed(() => this.selectedDay().completed ?? []);

  readonly cells = computed(() => {
    const byDate = this.calendarByDate();

    return this.buildMonthCells(this.currentMonth()).map((cell) => {
      const day = byDate.get(cell.isoDate);
      const scheduled = day?.scheduled ?? [];
      const completed = day?.completed ?? [];
      const openPlannedChapters = scheduled.filter((item) => !item.doneDate).length;
      const alreadyDoneChapters = scheduled.filter((item) => this.isAlreadyDone(item)).length;
      const missedChapters = cell.isoDate < this.todayIso ? openPlannedChapters : 0;

      return {
        ...cell,
        isSelected: cell.isoDate === this.selectedDate(),
        completedChapters: day?.completedChapters ?? completed.length,
        plannedChapters: day?.plannedChapters ?? scheduled.length,
        openPlannedChapters,
        alreadyDoneChapters,
        missedChapters
      };
    });
  });

  constructor() {
    this.loadCalendar();
  }

  loadCalendar() {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.progressService
      .getCalendarData()
      .pipe(
        catchError(() => {
          this.errorMessage.set('Could not load calendar.');
          return of([]);
        })
      )
      .subscribe((days) => {
        this.calendarDays.set(days);
        this.isLoading.set(false);
      });
  }

  previousMonth() {
    this.shiftMonth(-1);
  }

  nextMonth() {
    this.shiftMonth(1);
  }

  goToToday() {
    const today = new Date();
    this.currentMonth.set(this.startOfMonth(today));
    this.selectedDate.set(this.todayIso);
  }

  selectDay(cell: CalendarCell) {
    this.selectedDate.set(cell.isoDate);

    if (!cell.inMonth) {
      this.currentMonth.set(this.startOfMonth(cell.date));
    }
  }

  getItemBook(item: ReadingPlanItem) {
    return item.bookTitle || item.book || 'Untitled book';
  }

  getItemChapter(item: ReadingPlanItem) {
    return item.chapterTitle || item.chapter || 'Untitled chapter';
  }

  getItemSeries(item: ReadingPlanItem) {
    return item.seriesName || item.series || '';
  }

  getScheduledStatus(item: ReadingPlanItem) {
    if (this.isAlreadyDone(item)) {
      return 'Already done';
    }

    return item.doneDate ? 'Read' : 'Planned';
  }

  markItemRead(item: ReadingPlanItem) {
    if (item.doneDate || this.isSavingAction()) return;

    this.isSavingAction.set(true);
    this.progressService.markChapterRead(item.chapterId, this.todayIso).subscribe({
      next: () => {
        this.isSavingAction.set(false);
        this.loadCalendar();
      },
      error: () => {
        this.isSavingAction.set(false);
        this.errorMessage.set('Could not mark chapter as read.');
      }
    });
  }

  openReschedule(item: ReadingPlanItem) {
    this.rescheduleItem.set(item);
    this.rescheduleDate.set(item.scheduledDate || this.selectedDate());
  }

  closeReschedule() {
    this.rescheduleItem.set(null);
    this.rescheduleDate.set('');
  }

  saveReschedule() {
    const item = this.rescheduleItem();
    const date = this.rescheduleDate();

    if (!item || !date || this.isSavingAction()) return;

    this.isSavingAction.set(true);
    this.progressService.scheduleChapter(item.chapterId, date).subscribe({
      next: () => {
        this.isSavingAction.set(false);
        this.closeReschedule();
        this.selectedDate.set(date);
        this.currentMonth.set(this.startOfMonth(new Date(`${date}T00:00:00`)));
        this.loadCalendar();
      },
      error: () => {
        this.isSavingAction.set(false);
        this.errorMessage.set('Could not reschedule chapter.');
      }
    });
  }

  openBook(item: ReadingPlanItem) {
    this.router.navigate(['/book-progress'], {
      queryParams: { series: item.seriesId, book: item.bookId }
    });
  }

  openReadingPlan() {
    this.router.navigate(['/reading-plan']);
  }

  private shiftMonth(offset: number) {
    const month = this.currentMonth();
    this.currentMonth.set(new Date(month.getFullYear(), month.getMonth() + offset, 1));
  }

  private buildMonthCells(date: Date): CalendarCell[] {
    const start = this.startOfMonth(date);
    const startOffset = (start.getDay() + 6) % 7;
    const firstCell = new Date(start);
    firstCell.setDate(start.getDate() - startOffset);

    return Array.from({ length: 42 }, (_, index) => {
      const cellDate = new Date(firstCell);
      cellDate.setDate(firstCell.getDate() + index);

      return {
        date: cellDate,
        isoDate: this.toIsoDate(cellDate),
        inMonth: cellDate.getMonth() === date.getMonth(),
        isToday: this.toIsoDate(cellDate) === this.todayIso,
        isSelected: false,
        completedChapters: 0,
        plannedChapters: 0,
        openPlannedChapters: 0,
        alreadyDoneChapters: 0,
        missedChapters: 0
      };
    });
  }

  private startOfMonth(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  private toIsoDate(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private emptyDay(date: string): CalendarDay {
    return {
      date,
      completedChapters: 0,
      plannedChapters: 0,
      scheduled: [],
      completed: []
    };
  }

  private isAlreadyDone(item: ReadingPlanItem) {
    return Boolean(item.doneDate && item.scheduledDate && item.doneDate < item.scheduledDate);
  }
}
