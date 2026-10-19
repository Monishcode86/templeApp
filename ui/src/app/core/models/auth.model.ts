export interface User {
  _id?: string;
  id?: string;
  username: string;
  email?: string | null;
  role: 'ADMIN' | 'USER';
  user_id?: string | null;
  employee_id?: string | null;
  image?: string | null;
  address?: string;
  country_code?: string;
  mobile_number?: string | null;
  alt_country_code?: string;
  alt_mobile_number?: string | null;
  plant_id?: string | null;
  plant_name?: string | null;
  createdAt?: any;
  updatedAt?: any;
}

export interface Donation {
  _id?: string;
  id?: string;
  user_id: string;
  username?: string | null;
  type: 'UPI' | 'Cash' | 'Cheque';
  amount: number;
  remarks?: string | null;
  whatsapp_send: boolean;
  date?: string | Date;
  createdAt?: any;
  updatedAt?: any;
}

export interface PendingNotification extends Donation {
  mobile_number?: string | null;
  country_code?: string;
  has_valid_mobile?: boolean;
}

export interface NotificationFailure {
  _id?: string;
  id?: string;
  donation_id: string;
  user_id: string;
  username?: string | null;
  country_code?: string;
  mobile_number?: string | null;
  amount: number;
  donation_type?: string;
  error_message: string;
  status: 'FAILED' | 'RESOLVED';
  retry_count: number;
  failed_at: any;
  createdAt?: any;
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
