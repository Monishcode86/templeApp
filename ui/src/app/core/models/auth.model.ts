export interface User {
  _id?: string;
  id?: string;
  username: string;
  email: string;
  role: 'ADMIN' | 'USER';
  employee_id?: string | null;
  image?: string | null;
  plant_id?: string | null;
  plant_name?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Plant {
  _id?: string;
  plant_id: string;
  plant_name: string;
  location: string;
  plant_img?: string | null;
  pincode: string;
  no_of_employee?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Shift {
  _id?: string;
  shift_id?: number;
  shift_name: string;
  plant_id: string;
  plant_name: string;
  start_time: string;
  end_time: string;
  is_last?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface DepartmentShift {
  shift_id: number;
  shift_name: string;
  start_time: string;
  end_time: string;
  duration?: string;
}

export interface Department {
  _id?: string;
  department_id?: string;
  department_name: string;
  plant_id: string;
  plant_name: string;
  is_shift: boolean;
  shift_data: DepartmentShift[];
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  token?: string;
  user: User;
}

export interface PaginationMetadata {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T = any> {
  status: 'Success' | 'Error' | 'OK';
  message?: string;
  data?: T;
  pagination?: PaginationMetadata;
  statusCode?: number;
}
