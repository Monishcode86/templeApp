export interface FamilyMember {
  _id?: string;
  id?: string;
  username: string;
  email?: string | null;
  country_code?: string;
  mobile_number?: string | null;
  relation_type: string;
}

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
  address_line1?: string;
  address_line2?: string;
  nation?: string;
  state?: string;
  city?: string;
  pincode?: string;
  country_code?: string;
  mobile_number?: string | null;
  alt_country_code?: string;
  alt_mobile_number?: string | null;
  family_data?: FamilyMember[];
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
  financial_year?: string;
  receipt_no?: number;
  receipt_number?: string;
  donor_name?: string | null;
  donor_mobile?: string | null;
  donor_email?: string | null;
  donor_address?: string | null;
  type: 'UPI' | 'Cash' | 'Cheque';
  upi_ref_no?: string | null;
  cheque_no?: string | null;
  bank_name?: string | null;
  amount: number;
  amount_in_words?: string | null;
  amount_in_words_ta?: string | null;
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
