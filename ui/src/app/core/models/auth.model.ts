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

export interface PartOperation {
  operation_name: string;
  run_time: number;
  load_time: number;
  unload_time: number;
  cycle_type: 'part_per_cycle' | 'unit_per_parts';
  count: number;
}

export interface PartMaster {
  _id?: string;
  part_id?: string;
  program_number: string;
  part_name: string;
  plant_id: string;
  plant_name: string;
  has_operation: boolean;
  run_time?: number;
  load_time?: number;
  unload_time?: number;
  cycle_type?: 'part_per_cycle' | 'unit_per_parts';
  count?: number;
  operations?: PartOperation[];
  createdAt?: string;
  updatedAt?: string;
}

export interface DowntimeSubReason {
  subreason_id: string;
  sub_reason: string;
}

export interface DowntimeReason {
  _id?: string;
  plant_id: string;
  plant_name: string;
  downtime_type: 'rejection' | 'downtime';
  reason_id?: string; // RE-1 or DT-1
  mainreason_id: string;
  main_reason: string;
  subreason_id?: string;
  sub_reason?: string;
  sub_reasons?: DowntimeSubReason[];
  createdAt?: string;
  updatedAt?: string;
}

export interface MachineType {
  _id?: string;
  plant_id: string;
  plant_name: string;
  machinetype_id?: string; // M1, M2, M3...
  machinetype: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Machine {
  _id?: string;
  plant_id: string;
  plant_name: string;
  department_id: string;
  department_name: string;
  machinetype: string;
  machinetype_id?: string;
  machine_id?: string; // M1, M2...
  machine_ip: string;
  machine_liscence: string;
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
