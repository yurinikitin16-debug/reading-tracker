import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent)
  },
  {
    path: 'series',
    loadComponent: () =>
      import('./pages/series/series.component').then((m) => m.SeriesComponent)
  },
  {
    path: 'reading-plan',
    loadComponent: () =>
      import('./pages/reading-plan/reading-plan.component').then((m) => m.ReadingPlanComponent)
  },
  {
    path: 'book-progress',
    loadComponent: () =>
      import('./pages/book-progress/book-progress.component').then((m) => m.BookProgressComponent)
  },
  {
    path: 'statistics',
    loadComponent: () =>
      import('./pages/statistics/statistics.component').then((m) => m.StatisticsComponent)
  },
  {
    path: 'calendar',
    loadComponent: () =>
      import('./pages/calendar/calendar.component').then((m) => m.CalendarComponent)
  },
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: '**', redirectTo: 'dashboard' }
];
