import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ApiResponse, PendingNotification, NotificationFailure } from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private api = inject(ApiService);

  /**
   * Fetch pending WhatsApp notifications (whatsapp_send: false)
   */
  getPendingNotifications(params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Observable<ApiResponse<PendingNotification[]>> {
    const queryParams: any = {};
    if (params?.page) queryParams.page = params.page;
    if (params?.limit) queryParams.limit = params.limit;
    if (params?.search) queryParams.search = params.search;
    return this.api.get<ApiResponse<PendingNotification[]>>('/notification/pending', { params: queryParams });
  }

  /**
   * Trigger WhatsApp message for a specific donation
   */
  sendNotification(donationId: string): Observable<ApiResponse<any>> {
    return this.api.post<ApiResponse<any>>(`/notification/send/${donationId}`, {});
  }

  /**
   * Send WhatsApp messages to multiple donations in parallel
   */
  sendBulkNotifications(donationIds: string[]): Observable<ApiResponse<{ requested: number; successful: number; failed: number; results: any[] }>> {
    return this.api.post<ApiResponse<any>>('/notification/send-bulk', { donationIds });
  }

  /**
   * Get WhatsApp client status (Baileys / Business API)
   */
  getWhatsAppStatus(): Observable<ApiResponse<{ provider: string; status: string; info?: any; message?: string }>> {
    return this.api.get<ApiResponse<any>>('/notification/status');
  }

  /**
   * Fetch failed WhatsApp notifications
   */
  getFailedNotifications(params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Observable<ApiResponse<NotificationFailure[]>> {
    const queryParams: any = {};
    if (params?.page) queryParams.page = params.page;
    if (params?.limit) queryParams.limit = params.limit;
    if (params?.search) queryParams.search = params.search;
    return this.api.get<ApiResponse<NotificationFailure[]>>('/notification/failed', { params: queryParams });
  }
}
