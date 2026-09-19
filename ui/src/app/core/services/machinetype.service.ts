import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { MachineType, ApiResponse } from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class MachineTypeService {
  private api = inject(ApiService);

  getMachineTypes(params?: {
    search?: string;
    page?: number;
    limit?: number;
    plant_id?: string;
  }): Observable<ApiResponse<MachineType[]>> {
    const queryParams: any = {};
    if (params?.search) queryParams.search = params.search;
    if (params?.page) queryParams.page = params.page;
    if (params?.limit) queryParams.limit = params.limit;
    if (params?.plant_id) queryParams.plant_id = params.plant_id;
    return this.api.get<ApiResponse<MachineType[]>>('/machinetype', { params: queryParams });
  }

  getMachineTypeById(id: string): Observable<ApiResponse<MachineType>> {
    return this.api.get<ApiResponse<MachineType>>(`/machinetype/${id}`);
  }

  createMachineType(data: Partial<MachineType>): Observable<ApiResponse<MachineType>> {
    return this.api.post<ApiResponse<MachineType>>('/machinetype', data);
  }

  updateMachineType(id: string, data: Partial<MachineType>): Observable<ApiResponse<MachineType>> {
    return this.api.put<ApiResponse<MachineType>>(`/machinetype/${id}`, data);
  }

  deleteMachineType(id: string): Observable<ApiResponse<any>> {
    return this.api.delete<ApiResponse<any>>(`/machinetype/${id}`);
  }
}
