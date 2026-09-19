import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent),
    canActivate: [guestGuard],
  },
  {
    path: '',
    loadComponent: () =>
      import('./layout/admin-layout.component').then((m) => m.AdminLayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'users',
        loadComponent: () => import('./pages/users/users.component').then((m) => m.UsersComponent),
      },
      {
        path: 'plants',
        loadComponent: () =>
          import('./pages/plants/plants.component').then((m) => m.PlantsComponent),
      },
      {
        path: 'shifts',
        loadComponent: () =>
          import('./pages/shifts/shifts.component').then((m) => m.ShiftsComponent),
      },
      {
        path: 'departments',
        loadComponent: () =>
          import('./pages/departments/departments.component').then((m) => m.DepartmentsComponent),
      },
      {
        path: 'parts',
        loadComponent: () => import('./pages/parts/parts.component').then((m) => m.PartsComponent),
      },
      {
        path: 'downtime',
        loadComponent: () =>
          import('./pages/downtime/downtime.component').then((m) => m.DowntimeComponent),
      },
      {
        path: 'machinetype',
        loadComponent: () =>
          import('./pages/machinetype/machinetype.component').then((m) => m.MachineTypeComponent),
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
