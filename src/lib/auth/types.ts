export type SmaiVerificationStatus = "pending" | "verified" | "flagged" | "revoked";
export type AuthUser = {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
  smaiId: string;
  smaiVerificationStatus: SmaiVerificationStatus;
  smaiVerifiedAt: string | null;
};
export type AuthSession = { user: AuthUser };

export type AuthContext = {
  user: AuthUser | null;
  session: AuthSession | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error?: string; requiresVerification?: boolean }>;
  signOut: () => Promise<void>;
  signInWithOAuth: (provider: "google") => Promise<void>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  confirmEmail: (token: string) => Promise<{ error?: string }>;
  updateProfile: (data: { displayName?: string; preferredCurrency?: string }) => Promise<{ error?: string }>;
};

export type AuthState = {
  user: AuthUser | null;
  session: AuthSession | null;
  loading: boolean;
  error: string | null;
};
