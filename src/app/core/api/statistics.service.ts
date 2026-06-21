import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import { API_BASE_URL } from './api.config';
import { PovStatisticsResponse, StatisticsSummary } from '../models/library.models';

@Injectable({ providedIn: 'root' })
export class StatisticsService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  getStatistics() {
    return this.http.get<StatisticsSummary>(`${this.apiBaseUrl}/statistics`);
  }

  getPovStatisticsBySeries(seriesId: number) {
    return this.http.get<PovStatisticsResponse>(`${this.apiBaseUrl}/statistics/pov`, {
      params: { seriesId }
    });
  }

  getPovStatisticsByBook(bookId: number) {
    return this.http.get<PovStatisticsResponse>(`${this.apiBaseUrl}/statistics/pov`, {
      params: { bookId }
    });
  }
}
