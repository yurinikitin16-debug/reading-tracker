import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { catchError, of, shareReplay } from 'rxjs';

import { DashboardService } from '../../core/api/dashboard.service';

@Component({
  selector: 'app-dashboard',
  imports: [AsyncPipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
  private readonly dashboardService = inject(DashboardService);

  readonly summary$ = this.dashboardService.getSummary().pipe(
    shareReplay(1),
    catchError(() => of(null))
  );
}
