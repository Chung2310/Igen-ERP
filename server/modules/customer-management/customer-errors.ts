export class CustomerError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number = 400,
  ) {
    super(message);
    this.name = "CustomerError";
  }
}
