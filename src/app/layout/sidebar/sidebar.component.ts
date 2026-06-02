import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface NavItem {
  label: string;
  path: string;
  icon: string;
}

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {
  readonly navItems: NavItem[] = [
    { label: 'Dashboard', path: '/dashboard', icon: '⌂' },
    { label: 'Series', path: '/series', icon: '▦' },
    { label: 'Reading Plan', path: '/reading-plan', icon: '☷' },
    { label: 'Book Progress', path: '/book-progress', icon: '◴' },
    { label: 'Statistics', path: '/statistics', icon: '▥' },
    { label: 'Calendar', path: '/calendar', icon: '□' }
  ];
}
