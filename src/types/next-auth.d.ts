import "next-auth/jwt";

declare module "next-auth/jwt" {
  interface JWT {
    teamVerified?: boolean;
    googleAccessToken?: string;
    googleRefreshToken?: string;
    googleAccessTokenExpiresAt?: number;
    googleTokenError?: string;
  }
}
