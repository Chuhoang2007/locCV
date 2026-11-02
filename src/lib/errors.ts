export class AppError extends Error {
  constructor(public code: string, public status: number, message: string, public fields?:{path:(string|number)[];message:string}[]) {
    super(message); this.name = "AppError";
  }
}
export const configurationError = () => new AppError("SERVICE_NOT_CONFIGURED", 503, "Dịch vụ tài khoản đang được thiết lập. Vui lòng thử lại sau.");
