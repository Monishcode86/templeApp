import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Machine, ApiResponse } from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class MachineService {
  private api = inject(ApiService);

  getMachines(params?: {
    search?: string;
    page?: number;
    limit?: number;
    plant_id?: string;
    department_id?: string;
    machinetype?: string;
  }): Observable<ApiResponse<Machine[]>> {
    const queryParams: any = {};
    if (params?.search) queryParams.search = params.search;
    if (params?.page) queryParams.page = params.page;
    if (params?.limit) queryParams.limit = params.limit;
    if (params?.plant_id) queryParams.plant_id = params.plant_id;
    if (params?.department_id) queryParams.department_id = params.department_id;
    if (params?.machinetype) queryParams.machinetype = params.machinetype;
    return this.api.get<ApiResponse<Machine[]>>('/machine', { params: queryParams });
  }

  getMachineById(id: string): Observable<ApiResponse<Machine>> {
    return this.api.get<ApiResponse<Machine>>(`/machine/${id}`);
  }

  createMachine(data: Partial<Machine>): Observable<ApiResponse<Machine>> {
    return this.api.post<ApiResponse<Machine>>('/machine', data);
  }

  updateMachine(id: string, data: Partial<Machine>): Observable<ApiResponse<Machine>> {
    return this.api.put<ApiResponse<Machine>>(`/machine/${id}`, data);
  }

  deleteMachine(id: string): Observable<ApiResponse<any>> {
    return this.api.delete<ApiResponse<any>>(`/machine/${id}`);
  }
}
