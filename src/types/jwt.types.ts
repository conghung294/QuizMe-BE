export interface JwtPayload {
  sub: string; // user ID
  email: string;
  iat?: number;
  exp?: number;
}

export interface TokenVerificationResult {
  sub: string;
  email: string;
  iat: number;
  exp: number;
}
