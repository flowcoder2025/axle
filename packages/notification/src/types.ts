import type { NotificationType } from "@prisma/client";

export type { NotificationType };

export interface NotificationPayload {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
}

export type NotificationChannel = "in_app" | "email" | "push";
