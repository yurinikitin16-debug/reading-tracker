import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';

import { API_BASE_URL } from './api.config';
import { CalendarDay, ReadingPlanForecastResponse, ReadingPlanItem } from '../models/library.models';

export interface AddBookToPlanInput {
  bookId: number;
  startDate: string;
}

export interface NextPlanDate {
  nextDate: string;
}

@Injectable({ providedIn: 'root' })
export class ReadingProgressService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  getReadingPlan() {
    return this.http.get<ReadingPlanItem[]>(`${this.apiBaseUrl}/reading-progress/plan`);
  }

  getNextPlanDate() {
    return this.http.get<NextPlanDate>(`${this.apiBaseUrl}/reading-progress/plan/next-date`);
  }

  getPlanForecast() {
    return this.http.get<ReadingPlanForecastResponse>(`${this.apiBaseUrl}/reading-progress/plan/forecast`);
  }

  addBookToPlan(data: AddBookToPlanInput) {
    return this.http.post<ReadingPlanItem[]>(`${this.apiBaseUrl}/reading-progress/plan/books`, data);
  }

  getTodayChapter() {
    return this.http.get<ReadingPlanItem | null>(`${this.apiBaseUrl}/reading-progress/today`);
  }

  getCalendarData() {
    return this.http.get<CalendarDay[]>(`${this.apiBaseUrl}/reading-progress/calendar`).pipe(
      map((days) => days.map((day) => ({
        ...day,
        completedChapters: day.completedChapters ?? day.completed?.length ?? 0,
        plannedChapters: day.plannedChapters ?? day.scheduled?.length ?? 0,
        scheduled: day.scheduled ?? [],
        completed: day.completed ?? []
      })))
    );
  }

  scheduleChapter(chapterId: number, scheduledDate: string) {
    return this.http.put<ReadingPlanItem>(`${this.apiBaseUrl}/reading-progress/chapters/${chapterId}/schedule`, {
      scheduledDate
    });
  }

  markChapterRead(chapterId: number, doneDate = new Date().toISOString().slice(0, 10)) {
    return this.http.post<ReadingPlanItem>(`${this.apiBaseUrl}/reading-progress/chapters/${chapterId}/read`, {
      doneDate
    });
  }

  unmarkChapterRead(chapterId: number) {
    return this.http.delete<ReadingPlanItem>(`${this.apiBaseUrl}/reading-progress/chapters/${chapterId}/read`);
  }
}
