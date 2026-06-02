import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import { API_BASE_URL } from './api.config';
import { BookProgress, SeriesDetails, SeriesProgress } from '../models/library.models';

export interface SeriesInput {
  name: string;
  coverUrl?: string | null;
}

@Injectable({ providedIn: 'root' })
export class SeriesService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  getSeries() {
    return this.http.get<SeriesProgress[]>(`${this.apiBaseUrl}/series`);
  }

  getSeriesDetails(id: number) {
    return this.http.get<SeriesDetails>(`${this.apiBaseUrl}/series/${id}`);
  }

  createSeries(data: SeriesInput) {
    return this.http.post<SeriesProgress>(`${this.apiBaseUrl}/series`, data);
  }

  updateSeries(id: number, data: SeriesInput) {
    return this.http.put<SeriesProgress>(`${this.apiBaseUrl}/series/${id}`, data);
  }

  deleteSeries(id: number) {
    return this.http.delete<void>(`${this.apiBaseUrl}/series/${id}`);
  }

  getBooksBySeries(seriesId: number) {
    return this.http.get<BookProgress[]>(`${this.apiBaseUrl}/series/${seriesId}/books`);
  }
}
