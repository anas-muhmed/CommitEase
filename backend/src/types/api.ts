export interface ApiResponse<T = null> {
  success: boolean;
  message: string;
  data: T | null;
}

export interface ApiErrorResponse extends ApiResponse<null> {
  errors?: Record<string, string>;
}
