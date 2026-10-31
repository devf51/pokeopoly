// code: NOT_YOUR_TURN | INVALID_ACTION | NO_USES | NO_BALL | NOT_ENOUGH_MONEY | BAD_TARGET | LEGENDARY
// message เป็นภาษาไทยเสมอ
export class GameError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'GameError';
    this.code = code;
  }
}
