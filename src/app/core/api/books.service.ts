import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import { API_BASE_URL } from './api.config';
import { BookProgress } from '../models/library.models';

export interface BookInput {
  title: string;
  author?: string | null;
  bookOrder: number;
  pages?: number | null;
  coverUrl?: string | null;
}

@Injectable({ providedIn: 'root' })
export class BooksService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  createBook(seriesId: number, data: BookInput) {
    return this.http.post<BookProgress>(`${this.apiBaseUrl}/series/${seriesId}/books`, data);
  }

  updateBook(id: number, data: BookInput) {
    return this.http.put<BookProgress>(`${this.apiBaseUrl}/books/${id}`, data);
  }

  deleteBook(id: number) {
    return this.http.delete<void>(`${this.apiBaseUrl}/books/${id}`);
  }
}
