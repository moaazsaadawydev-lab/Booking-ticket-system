import { ClientScope, UserRole, UserStatus } from '@booking-ticket-system/Utils';

export type AccessPayloadType = {
  id: string;
  role: UserRole;
  status: UserStatus;
  sessionId?: string;
  cinemaId?: string | null;
  scope?: ClientScope | string;
};

export type RefreshPayloadType = {
  id: string;
  sessionId?: string;
};
