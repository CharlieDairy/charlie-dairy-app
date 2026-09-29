// Plain error classes (no server-only imports) so they can be thrown from
// helpers and turned into a friendly form message by runAction().

/** The caller isn't signed in, is disabled, or lacks the required role/module. */
export class AccessError extends Error {
  constructor(message = "You don't have permission to do that.") {
    super(message);
    this.name = "AccessError";
  }
}

/** Bad user input. The message is safe to show to the user as-is. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
