import type { Role } from "./permissions";

/** Request context passed to every service. */
export interface Ctx {
  userId: string;
  role: Role;
  name: string;
  email: string;
  memberId?: string | null;
}
