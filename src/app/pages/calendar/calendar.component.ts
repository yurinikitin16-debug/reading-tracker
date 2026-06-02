import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { catchError, map, of } from 'rxjs';

import { ReadingProgressService } from '../../core/api/reading-progress.service';

interface CalendarCell {
  date: Date;
  isoDate: string;
  inMonth: boolean;
  completedChapters: number;
  plannedChapters: number;
}

@Component({
  selector: 'app-calendar',
  imports: [AsyncPipe, DatePipe],
  templateUrl: './calendar.component.html',
  styleUrl: './calendar.component.scss'
})
export class CalendarComponent {
  private readonly progressService = inject(ReadingProgressService);
  readonly currentMonth = new Date();
  readonly weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  readonly cells$ = this.progressService.getCalendarData().pipe(
    map((days) => {
      const byDate = new Map(days.map((day) => [day.date, day]));
      return this.buildMonthCells(this.currentMonth).map((cell) => ({
        ...cell,
        completedChapters: byDate.get(cell.isoDate)?.completedChapters ?? 0,
        plannedChapters: byDate.get(cell.isoDate)?.plannedChapters ?? 0
      }));
    }),
    catchError(() => of(this.buildMonthCells(this.currentMonth)))
  );

  private buildMonthCells(date: Date): CalendarCell[] {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const startOffset = (start.getDay() + 6) % 7;
    const firstCell = new Date(start);
    firstCell.setDate(start.getDate() - startOffset);

    return Array.from({ length: 42 }, (_, index) => {
      const cellDate = new Date(firstCell);
      cellDate.setDate(firstCell.getDate() + index);
      return {
        date: cellDate,
        isoDate: cellDate.toISOString().slice(0, 10),
        inMonth: cellDate.getMonth() === date.getMonth(),
        completedChapters: 0,
        plannedChapters: 0
      };
    });
  }
}
