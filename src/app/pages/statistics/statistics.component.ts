import { DatePipe } from '@angular/common';
import { Component, DestroyRef, ElementRef, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import Chart from 'chart.js/auto';
import { catchError, of } from 'rxjs';

import { StatisticsService } from '../../core/api/statistics.service';
import { CompletedByDay, StatisticsSummary } from '../../core/models/library.models';

type StatisticsTab = 'overview' | 'series' | 'month' | 'day';
type ChartRange = '3' | '7' | '30' | '60' | '90';

interface ChartRangeOption {
  value: ChartRange;
  label: string;
  days: number;
}

@Component({
  selector: 'app-statistics',
  imports: [DatePipe, FormsModule],
  templateUrl: './statistics.component.html',
  styleUrl: './statistics.component.scss'
})
export class StatisticsComponent {
  private readonly statisticsService = inject(StatisticsService);
  private readonly destroyRef = inject(DestroyRef);
  private chart: Chart<'line'> | null = null;
  private chartCanvas: ElementRef<HTMLCanvasElement> | null = null;

  @ViewChild('readingTrendChart')
  set readingTrendChart(canvas: ElementRef<HTMLCanvasElement> | undefined) {
    this.chartCanvas = canvas ?? null;
    this.renderChart();
  }

  readonly activeTab = signal<StatisticsTab>('overview');
  readonly chartRange = signal<ChartRange>('30');
  readonly selectedChartDay = signal<CompletedByDay | null>(null);
  readonly summary = signal<StatisticsSummary | null>(null);
  readonly isLoading = signal(false);
  readonly errorMessage = signal('');

  readonly tabs: { id: StatisticsTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'series', label: 'By Series' },
    { id: 'month', label: 'By Month' },
    { id: 'day', label: 'By Day' }
  ];

  readonly chartRangeOptions: ChartRangeOption[] = [
    { value: '30', label: 'Last 30 days', days: 30 },
    { value: '3', label: 'Last 3 days', days: 3 },
    { value: '7', label: 'Last week', days: 7 },
    { value: '60', label: 'Last 2 months', days: 60 },
    { value: '90', label: 'Last 3 months', days: 90 }
  ];

  readonly completedDays = computed<CompletedByDay[]>(() =>
    (this.summary()?.completedByDay ?? [])
      .filter((day) => day.completedChapters > 0)
      .sort((first, second) => first.date.localeCompare(second.date))
  );

  readonly selectedRangeOption = computed(() =>
    this.chartRangeOptions.find((option) => option.value === this.chartRange()) ?? this.chartRangeOptions[2]
  );

  readonly selectedRangeDays = computed<CompletedByDay[]>(() => {
    const daysByDate = new Map(this.completedDays().map((day) => [day.date, day.completedChapters]));
    const today = new Date();
    const rangeDays = this.selectedRangeOption().days;

    return Array.from({ length: rangeDays }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (rangeDays - 1 - index));
      const isoDate = this.toIsoDate(date);

      return {
        date: isoDate,
        completedChapters: daysByDate.get(isoDate) ?? 0
      };
    });
  });

  readonly monthStats = computed(() =>
    (this.summary()?.completedByMonth ?? [])
      .map((month) => ({
        ...month,
        label: this.formatMonth(month.month)
      }))
      .sort((first, second) => first.month.localeCompare(second.month))
  );

  readonly dayStats = computed<CompletedByDay[]>(() => this.completedDays().slice().reverse());

  readonly averageChaptersPerDay = computed(() => {
    const total = this.last30Days().reduce((sum, day) => sum + day.completedChapters, 0);
    return total / 30;
  });

  readonly last30Days = computed<CompletedByDay[]>(() => {
    const daysByDate = new Map(this.completedDays().map((day) => [day.date, day.completedChapters]));
    const today = new Date();

    return Array.from({ length: 30 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (29 - index));
      const isoDate = this.toIsoDate(date);

      return {
        date: isoDate,
        completedChapters: daysByDate.get(isoDate) ?? 0
      };
    });
  });

  readonly readingDaysLast30 = computed(() =>
    this.last30Days().filter((day) => day.completedChapters > 0).length
  );

  readonly maxMonth = computed(() =>
    Math.max(1, ...this.monthStats().map((month) => month.completedChapters))
  );

  readonly maxDay = computed(() =>
    Math.max(1, ...this.dayStats().map((day) => day.completedChapters))
  );

  constructor() {
    effect(() => {
      this.selectedRangeDays();
      this.renderChart();
    });

    this.destroyRef.onDestroy(() => this.chart?.destroy());
    this.loadStatistics();
  }

  setTab(tab: StatisticsTab) {
    this.activeTab.set(tab);
  }

  setChartRange(value: string) {
    if (this.chartRangeOptions.some((option) => option.value === value)) {
      this.chartRange.set(value as ChartRange);
      this.selectedChartDay.set(null);
    }
  }

  selectChartDay(day: CompletedByDay) {
    this.selectedChartDay.set(day);
  }

  loadStatistics() {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.statisticsService
      .getStatistics()
      .pipe(
        catchError(() => {
          this.errorMessage.set('Could not load statistics.');
          return of(null);
        })
      )
      .subscribe((summary) => {
      this.summary.set(summary);
      this.isLoading.set(false);
      queueMicrotask(() => this.renderChart());
    });
  }

  progressWidth(completed: number, total: number) {
    return total === 0 ? '0%' : `${Math.round((completed / total) * 100)}%`;
  }

  private formatMonth(month: string) {
    return new Date(`${month}-01T00:00:00`).toLocaleDateString(undefined, {
      month: 'short',
      year: 'numeric'
    });
  }

  private toIsoDate(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private renderChart() {
    if (!this.chartCanvas || this.activeTab() !== 'overview') {
      return;
    }

    const canvas = this.chartCanvas.nativeElement;
    const context = canvas.getContext('2d');

    if (!context) {
      return;
    }

    const days = this.selectedRangeDays();
    const labels = days.map((day) => this.formatChartLabel(day.date));
    const values = days.map((day) => day.completedChapters);
    const gradient = context.createLinearGradient(0, 0, canvas.clientWidth || 720, 0);
    gradient.addColorStop(0, '#8b5cf6');
    gradient.addColorStop(1, '#38bdf8');

    if (!this.chart) {
      this.chart = new Chart(context, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            data: values,
            borderColor: gradient,
            backgroundColor: 'rgba(139, 92, 246, 0.14)',
            borderWidth: 2,
            fill: true,
            pointBackgroundColor: '#111520',
            pointBorderColor: '#a78bfa',
            pointBorderWidth: 2,
            pointHoverBackgroundColor: '#8b5cf6',
            pointHoverBorderColor: '#f6f7fb',
            pointHoverRadius: 5,
            pointRadius: 4,
            tension: 0.36
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 180 },
          interaction: {
            intersect: false,
            mode: 'index'
          },
          onClick: (_event, elements) => {
            const index = elements[0]?.index;
            const day = typeof index === 'number' ? days[index] : null;

            if (day) {
              this.selectedChartDay.set(day);
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              displayColors: false,
              callbacks: {
                title: (items) => items[0]?.label ?? '',
                label: (item) => `${item.parsed.y} chapters`
              }
            }
          },
          scales: {
            x: {
              grid: {
                color: 'rgba(255, 255, 255, 0.07)',
                tickColor: 'rgba(255, 255, 255, 0.08)'
              },
              ticks: {
                color: '#8f98aa',
                maxRotation: 0,
                autoSkip: true,
                maxTicksLimit: 6
              },
              border: {
                color: 'rgba(255, 255, 255, 0.1)'
              }
            },
            y: {
              beginAtZero: true,
              grace: '20%',
              grid: {
                color: 'rgba(255, 255, 255, 0.07)',
                tickColor: 'rgba(255, 255, 255, 0.08)'
              },
              ticks: {
                color: '#8f98aa',
                precision: 0,
                stepSize: 1
              },
              border: {
                color: 'rgba(255, 255, 255, 0.1)'
              }
            }
          }
        }
      });

      return;
    }

    this.chart.data.labels = labels;
    this.chart.data.datasets[0].data = values;
    this.chart.data.datasets[0].borderColor = gradient;
    this.chart.update();
  }

  private formatChartLabel(date: string) {
    return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric'
    });
  }
}
