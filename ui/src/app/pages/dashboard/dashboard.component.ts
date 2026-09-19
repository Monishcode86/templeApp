import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { UserService } from '../../core/services/user.service';
import { AuthService } from '../../core/services/auth.service';
import { TranslatePipe } from '../../core/services/translation.service';
import { User } from '../../core/models/auth.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslatePipe],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  userService = inject(UserService);
  authService = inject(AuthService);

  totalUsers = signal<number>(0);
  recentUsers = signal<User[]>([]);
  uptime = signal<string>('Connecting...');
  serverTimestamp = signal<string>('-');
  isLoading = signal<boolean>(true);

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.isLoading.set(true);

    // Fetch users count & list
    this.userService.getUsers().subscribe({
      next: (res) => {
        const allUsers = res.data || [];
        const isAdmin = this.authService.currentUser()?.role === 'ADMIN';
        const users = allUsers.filter((u) => u.email?.toLowerCase() !== 'admin@gmail.com' && (isAdmin || u.role !== 'ADMIN'));
        this.totalUsers.set(users.length);
        this.recentUsers.set(users.slice(0, 5));
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      }
    });

    // Fetch live system health & uptime
    this.userService.getSystemHealth().subscribe({
      next: (health) => {
        if (health && health.uptime) {
          const hours = Math.floor(health.uptime / 3600);
          const minutes = Math.floor((health.uptime % 3600) / 60);
          const seconds = Math.floor(health.uptime % 60);
          this.uptime.set(`${hours}h ${minutes}m ${seconds}s`);
          this.serverTimestamp.set(health.timestamp ? new Date(health.timestamp).toLocaleTimeString() : '-');
        }
      },
      error: () => {
        this.uptime.set('Offline');
      }
    });
  }
}
