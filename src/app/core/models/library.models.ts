export interface Progress {
  totalChapters: number;
  completedChapters: number;
  progressPercentage: number;
}

export interface SeriesProgress extends Progress {
  id: number;
  name: string;
  coverUrl?: string | null;
  booksCount?: number;
  completedBooksCount?: number;
}

export interface SeriesDetails {
  id: number;
  name: string;
  coverUrl?: string | null;
  books: BookProgress[];
}

export interface BookProgress extends Progress {
  id: number;
  seriesId: number;
  title: string;
  author?: string | null;
  bookOrder: number;
  pages?: number | null;
  coverUrl?: string | null;
}

export interface Chapter {
  id: number;
  bookId: number;
  chapterOrder: number;
  title: string;
  pages?: number | null;
  scheduledDate?: string | null;
  doneDate?: string | null;
}

export interface ReadingPlanItem {
  id?: number;
  bookId?: number;
  seriesId?: number;
  chapterId: number;
  scheduledDate?: string | null;
  doneDate?: string | null;
  series?: string;
  seriesName?: string;
  book?: string;
  bookTitle?: string;
  bookCoverUrl?: string | null;
  coverUrl?: string | null;
  cover_url?: string | null;
  chapter?: string;
  chapterTitle?: string;
  chapterOrder?: number;
  pages?: number | null;
}

export interface CalendarDay {
  date: string;
  completedChapters: number;
  plannedChapters: number;
}

export interface DashboardSummary {
  totalChapters: number;
  completedChapters: number;
  overallProgressPercentage: number;
  currentStreak: number;
  completedBooksCount: number;
  currentReadingChapter?: ReadingPlanItem | null;
  todayPlannedChapter?: ReadingPlanItem | null;
  progressBySeries: SeriesProgress[];
}

export interface ProgressBySeries {
  seriesId: number;
  seriesName: string;
  totalChapters: number;
  completedChapters: number;
  progressPercentage: number;
}

export interface CompletedByMonth {
  month: string;
  completedChapters: number;
}

export interface CompletedByDay {
  date: string;
  completedChapters: number;
}

export interface StatisticsSummary {
  totalChapters: number;
  completedChapters: number;
  overallProgressPercentage: number;
  completedBooksCount: number;
  currentStreak: number;
  longestStreak: number;
  progressBySeries: ProgressBySeries[];
  completedByMonth: CompletedByMonth[];
  completedByDay: CompletedByDay[];
}
