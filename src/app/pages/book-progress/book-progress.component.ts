import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { catchError, of } from 'rxjs';

import { BookInput, BooksService } from '../../core/api/books.service';
import { ChapterInput, ChaptersService } from '../../core/api/chapters.service';
import { SeriesService } from '../../core/api/series.service';
import { BookProgress, Chapter, SeriesDetails, SeriesProgress } from '../../core/models/library.models';

type BookModalMode = 'create' | 'edit';
type ChapterModalMode = 'create' | 'edit';

interface ParsedChapterImportRow {
  lineNumber: number;
  chapterOrder: number;
  title: string;
  pages: number | null;
  pov: string | null;
  error: string;
}

@Component({
  selector: 'app-book-progress',
  imports: [ReactiveFormsModule],
  templateUrl: './book-progress.component.html',
  styleUrl: './book-progress.component.scss'
})
export class BookProgressComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly booksService = inject(BooksService);
  private readonly chaptersService = inject(ChaptersService);
  private readonly seriesService = inject(SeriesService);

  readonly series = signal<SeriesProgress[]>([]);
  readonly selectedSeries = signal<SeriesDetails | null>(null);
  readonly selectedBook = signal<BookProgress | null>(null);
  readonly chapters = signal<Chapter[]>([]);
  readonly searchTerm = signal('');
  readonly isLoadingSeries = signal(false);
  readonly isLoadingBooks = signal(false);
  readonly isLoadingChapters = signal(false);
  readonly errorMessage = signal('');
  readonly bookMenuOpenId = signal<number | null>(null);
  readonly chapterMenuOpenId = signal<number | null>(null);

  readonly isBookEditorOpen = signal(false);
  readonly bookModalMode = signal<BookModalMode>('create');
  readonly activeBook = signal<BookProgress | null>(null);
  readonly confirmDeleteBook = signal<BookProgress | null>(null);

  readonly isChapterEditorOpen = signal(false);
  readonly isBulkChapterImportOpen = signal(false);
  readonly chapterModalMode = signal<ChapterModalMode>('create');
  readonly activeChapter = signal<Chapter | null>(null);
  readonly confirmDeleteChapter = signal<Chapter | null>(null);
  readonly bulkChapterText = signal('');

  readonly bookForm = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(255)]],
    author: [''],
    bookOrder: [1, [Validators.required, Validators.min(1)]],
    pages: [null as number | null],
    coverUrl: ['']
  });

  readonly chapterForm = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(255)]],
    chapterOrder: [1, [Validators.required, Validators.min(1)]],
    pages: [null as number | null],
    pov: ['']
  });

  readonly filteredBooks = computed(() => {
    const selected = this.selectedSeries();
    const query = this.searchTerm().trim().toLowerCase();

    if (!selected) {
      return [];
    }

    if (!query) {
      return selected.books;
    }

    return selected.books.filter((book) => {
      const haystack = `${book.title} ${book.author ?? ''}`.toLowerCase();
      return haystack.includes(query);
    });
  });

  readonly parsedBulkChapters = computed(() => this.parseBulkChapterText(this.bulkChapterText()));

  readonly validBulkChapters = computed(() =>
    this.parsedBulkChapters()
      .filter((row) => !row.error)
      .map((row) => ({
        chapterOrder: row.chapterOrder,
        title: row.title,
        pages: row.pages,
        pov: row.pov
      }))
  );

  readonly bulkImportHasErrors = computed(() => this.parsedBulkChapters().some((row) => row.error));

  constructor() {
    this.loadSeries();
  }

  @HostListener('document:click')
  closeMenusOnOutsideClick() {
    this.bookMenuOpenId.set(null);
    this.chapterMenuOpenId.set(null);
  }

  loadSeries() {
    this.isLoadingSeries.set(true);
    this.errorMessage.set('');

    this.seriesService
      .getSeries()
      .pipe(
        catchError(() => {
          this.errorMessage.set('Could not load series.');
          return of([]);
        })
      )
      .subscribe((items) => {
        this.series.set(items);
        this.isLoadingSeries.set(false);

        const routeSeriesId = Number(this.route.snapshot.queryParamMap.get('series'));
        const selectedId = items.some((item) => item.id === routeSeriesId) ? routeSeriesId : items[0]?.id;

        if (selectedId) {
          this.selectSeries(selectedId);
        }
      });
  }

  selectSeries(seriesId: number) {
    this.isLoadingBooks.set(true);
    this.errorMessage.set('');
    this.selectedBook.set(null);
    this.chapters.set([]);

    this.seriesService
      .getSeriesDetails(seriesId)
      .pipe(
        catchError(() => {
          this.errorMessage.set('Could not load series details.');
          return of(null);
        })
      )
      .subscribe((details) => {
        this.selectedSeries.set(details);
        this.isLoadingBooks.set(false);

        const firstBook = details?.books[0] ?? null;
        if (firstBook) {
          this.selectBook(firstBook);
        }
      });
  }

  selectSeriesByValue(value: string) {
    const seriesId = Number(value);

    if (Number.isFinite(seriesId)) {
      this.selectSeries(seriesId);
    }
  }

  selectBook(book: BookProgress) {
    this.selectedBook.set(book);
    this.isLoadingChapters.set(true);
    this.chapters.set([]);

    this.chaptersService
      .getChaptersByBook(book.id)
      .pipe(
        catchError(() => {
          this.errorMessage.set('Could not load chapters.');
          return of([]);
        })
      )
      .subscribe((chapters) => {
        this.chapters.set(chapters);
        this.isLoadingChapters.set(false);
      });
  }

  refreshSelectedSeries(preferredBookId?: number) {
    const selected = this.selectedSeries();

    if (!selected) {
      return;
    }

    this.seriesService
      .getSeriesDetails(selected.id)
      .pipe(catchError(() => of(null)))
      .subscribe((details) => {
        if (!details) {
          return;
        }

        this.selectedSeries.set(details);
        const bookId = preferredBookId ?? this.selectedBook()?.id;
        const nextBook = details.books.find((book) => book.id === bookId) ?? details.books[0] ?? null;

        if (nextBook) {
          this.selectBook(nextBook);
        } else {
          this.selectedBook.set(null);
          this.chapters.set([]);
        }
      });
  }

  openCreateBookModal() {
    const books = this.selectedSeries()?.books ?? [];
    const latestBook = [...books].sort((first, second) => second.bookOrder - first.bookOrder)[0];
    const nextOrder = books.length + 1;

    this.bookModalMode.set('create');
    this.activeBook.set(null);
    this.bookForm.reset({
      title: '',
      author: latestBook?.author ?? '',
      bookOrder: nextOrder,
      pages: null,
      coverUrl: ''
    });
    this.isBookEditorOpen.set(true);
    this.bookMenuOpenId.set(null);
  }

  openEditBookModal(book: BookProgress) {
    this.bookModalMode.set('edit');
    this.activeBook.set(book);
    this.bookForm.reset({
      title: book.title,
      author: book.author ?? '',
      bookOrder: book.bookOrder,
      pages: book.pages ?? null,
      coverUrl: book.coverUrl ?? ''
    });
    this.isBookEditorOpen.set(true);
    this.bookMenuOpenId.set(null);
  }

  closeBookEditor() {
    this.isBookEditorOpen.set(false);
    this.bookForm.reset();
  }

  saveBook() {
    const selected = this.selectedSeries();

    if (this.bookForm.invalid || !selected) {
      this.bookForm.markAllAsTouched();
      return;
    }

    const value = this.bookForm.getRawValue();
    const payload: BookInput = {
      title: value.title,
      author: value.author || null,
      bookOrder: value.bookOrder,
      pages: value.pages,
      coverUrl: value.coverUrl || null
    };
    const active = this.activeBook();

    const request =
      this.bookModalMode() === 'edit' && active
        ? this.booksService.updateBook(active.id, payload)
        : this.booksService.createBook(selected.id, payload);

    request.subscribe({
      next: () => {
        this.closeBookEditor();
        this.selectSeries(selected.id);
      },
      error: () => this.errorMessage.set('Could not save book. Check the books API route.')
    });
  }

  askDeleteBook(book: BookProgress) {
    this.confirmDeleteBook.set(book);
    this.bookMenuOpenId.set(null);
  }

  cancelDeleteBook() {
    this.confirmDeleteBook.set(null);
  }

  deleteBook() {
    const selected = this.selectedSeries();
    const book = this.confirmDeleteBook();

    if (!selected || !book) {
      return;
    }

    this.booksService.deleteBook(book.id).subscribe({
      next: () => {
        this.confirmDeleteBook.set(null);
        this.selectSeries(selected.id);
      },
      error: () => this.errorMessage.set('Could not delete book.')
    });
  }

  openCreateChapterModal() {
    const book = this.selectedBook();

    if (!book) {
      return;
    }

    this.chapterModalMode.set('create');
    this.activeChapter.set(null);
    this.chapterForm.reset({
      title: '',
      chapterOrder: this.chapters().length + 1,
      pages: null,
      pov: ''
    });
    this.isChapterEditorOpen.set(true);
    this.chapterMenuOpenId.set(null);
  }

  openBulkChapterImport() {
    const book = this.selectedBook();

    if (!book) {
      return;
    }

    this.bulkChapterText.set('');
    this.isBulkChapterImportOpen.set(true);
    this.chapterMenuOpenId.set(null);
  }

  closeBulkChapterImport() {
    this.isBulkChapterImportOpen.set(false);
    this.bulkChapterText.set('');
  }

  openEditChapterModal(chapter: Chapter) {
    this.chapterModalMode.set('edit');
    this.activeChapter.set(chapter);
    this.chapterForm.reset({
      title: chapter.title,
      chapterOrder: chapter.chapterOrder,
      pages: chapter.pages ?? null,
      pov: chapter.pov ?? ''
    });
    this.isChapterEditorOpen.set(true);
    this.chapterMenuOpenId.set(null);
  }

  closeChapterEditor() {
    this.isChapterEditorOpen.set(false);
    this.chapterForm.reset();
  }

  saveChapter() {
    const book = this.selectedBook();

    if (this.chapterForm.invalid || !book) {
      this.chapterForm.markAllAsTouched();
      return;
    }

    const value = this.chapterForm.getRawValue();
    const payload: ChapterInput = {
      title: value.title,
      chapterOrder: value.chapterOrder,
      pages: value.pages,
      pov: value.pov.trim() || null
    };
    const active = this.activeChapter();

    const request =
      this.chapterModalMode() === 'edit' && active
        ? this.chaptersService.updateChapter(active.id, payload)
        : this.chaptersService.createChapter(book.id, payload);

    request.subscribe({
      next: () => {
        this.closeChapterEditor();
        this.refreshSelectedSeries(book.id);
      },
      error: () => this.errorMessage.set('Could not save chapter. Check the chapters API route.')
    });
  }

  askDeleteChapter(chapter: Chapter) {
    this.confirmDeleteChapter.set(chapter);
    this.chapterMenuOpenId.set(null);
  }

  cancelDeleteChapter() {
    this.confirmDeleteChapter.set(null);
  }

  deleteChapter() {
    const book = this.selectedBook();
    const chapter = this.confirmDeleteChapter();

    if (!book || !chapter) {
      return;
    }

    this.chaptersService.deleteChapter(chapter.id).subscribe({
      next: () => {
        this.confirmDeleteChapter.set(null);
        this.refreshSelectedSeries(book.id);
      },
      error: () => this.errorMessage.set('Could not delete chapter.')
    });
  }

  importBulkChapters() {
    const book = this.selectedBook();
    const chapters = this.validBulkChapters();

    if (!book || chapters.length === 0 || this.bulkImportHasErrors()) {
      return;
    }

    this.chaptersService.createChaptersBulk(book.id, { chapters }).subscribe({
      next: () => {
        this.closeBulkChapterImport();
        this.refreshSelectedSeries(book.id);
      },
      error: () => this.errorMessage.set('Could not import chapters. Check the bulk chapters API route.')
    });
  }

  toggleBookMenu(id: number) {
    this.bookMenuOpenId.update((openId) => (openId === id ? null : id));
  }

  toggleChapterMenu(id: number) {
    this.chapterMenuOpenId.update((openId) => (openId === id ? null : id));
  }

  private parseBulkChapterText(value: string): ParsedChapterImportRow[] {
    const usedOrders = new Set<number>();
    let nextOrder = this.chapters().length + 1;

    return value
      .split(/\r?\n/)
      .map((line, index) => ({ line: line.trim(), lineNumber: index + 1 }))
      .filter(({ line }) => line.length > 0)
      .map(({ line, lineNumber }) => {
        const [leftRaw, pagesPart = '', povPart = '', ...extraParts] = line.split('|');
        const left = leftRaw.trim();
        const pagesRaw = pagesPart.trim();
        const pov = povPart.trim() || null;
        const numberedMatch = left.match(/^(\d+)(?:[.)]|\s+-\s+|\s+)(.+)$/);
        const hasExplicitOrder = Boolean(numberedMatch);
        const chapterOrder = numberedMatch ? Number(numberedMatch[1]) : nextOrder;
        const title = (numberedMatch ? numberedMatch[2] : left).trim();
        let pages: number | null = null;
        let error = '';

        if (!title) {
          error = 'Missing chapter title.';
        } else if (!Number.isInteger(chapterOrder) || chapterOrder < 1) {
          error = 'Chapter order must be a positive number.';
        } else if (usedOrders.has(chapterOrder)) {
          error = `Duplicate chapter order ${chapterOrder}.`;
        } else if (extraParts.length > 0) {
          error = 'Too many fields. Use title | pages | POV.';
        }

        if (!error && pagesRaw) {
          const parsedPages = Number(pagesRaw);

          if (!Number.isInteger(parsedPages) || parsedPages < 1) {
            error = 'Pages must be a positive number.';
          } else {
            pages = parsedPages;
          }
        }

        usedOrders.add(chapterOrder);
        nextOrder = hasExplicitOrder ? Math.max(nextOrder, chapterOrder + 1) : nextOrder + 1;

        return {
          lineNumber,
          chapterOrder,
          title,
          pages,
          pov,
          error
        };
      });
  }
}
