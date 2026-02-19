export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }

  static notFound(entity: string) {
    return new AppError(404, `${entity} not found`);
  }

  static badRequest(message: string) {
    return new AppError(400, message);
  }
}
