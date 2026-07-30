export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface AdminProfile {
  username: string;
  role: string;
}