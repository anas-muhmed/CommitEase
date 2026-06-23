export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly isOperational = true,
  ) {
    super(message);
    this.name = 'ApiError';
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}
