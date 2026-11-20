export interface AdminAccount {
  _id?: string;
  id?: string;
  username: string;
  role: 'ADMIN';
  fullName?: string;
  phone?: string;
  email?: string | null;
  status: 'ACTIVE' | 'LOCKED';
  createdAt?: string;
}

export interface AdminAccountFormState {
  username: string;
  password: string;
  fullName: string;
  phone: string;
  email: string;
  status: 'ACTIVE' | 'LOCKED';
}
