import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import { API_BASE_URL } from './api.config';
import { Chapter } from '../models/library.models';

export interface ChapterInput {
  title: string;
  chapterOrder: number;
  pages?: number | null;
}

export interface BulkChaptersInput {
  chapters: ChapterInput[];
}

@Injectable({ providedIn: 'root' })
export class ChaptersService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  getChaptersByBook(bookId: number) {
    return this.http.get<Chapter[]>(`${this.apiBaseUrl}/books/${bookId}/chapters`);
  }

  createChapter(bookId: number, data: ChapterInput) {
    return this.http.post<Chapter>(`${this.apiBaseUrl}/books/${bookId}/chapters`, data);
  }

  createChaptersBulk(bookId: number, data: BulkChaptersInput) {
    return this.http.post<Chapter[]>(`${this.apiBaseUrl}/books/${bookId}/chapters/bulk`, data);
  }

  updateChapter(id: number, data: ChapterInput) {
    return this.http.put<Chapter>(`${this.apiBaseUrl}/chapters/${id}`, data);
  }

  deleteChapter(id: number) {
    return this.http.delete<void>(`${this.apiBaseUrl}/chapters/${id}`);
  }
}
