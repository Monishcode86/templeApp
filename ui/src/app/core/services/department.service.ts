import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Department, ApiResponse } from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class DepartmentService {
  private api = inject(ApiService);

  getDepartments(params?: { search?: string; page?: number; limit?: number; plant_id?: string }): Observable<ApiResponse<Department[]>> {
    const queryParams: any = {};
    if (params?.search) queryParams.search = params.search;
    if (params?.page) queryParams.page = params.page;
    if (params?.limit) queryParams.limit = params.limit;
    if (params?.plant_id) queryParams.plant_id = params.plant_id;
    return this.api.get<ApiResponse<Department[]>>('/department', { params: queryParams });
  }

  getDepartmentById(id: string): Observable<ApiResponse<Department>> {
    return this.api.get<ApiResponse<Department>>(`/department/${id}`);
  }

  createDepartment(department: Partial<Department>): Observable<ApiResponse<Department>> {
    return this.api.post<ApiResponse<Department>>('/department', department);
  }

  updateDepartment(id: string, department: Partial<Department>): Observable<ApiResponse<Department>> {
    return this.api.put<ApiResponse<Department>>(`/department/${id}`, department);
  }

  deleteDepartment(id: string): Observable<ApiResponse<any>> {
    return this.api.delete<ApiResponse<any>>(`/department/${id}`);
  }
}
