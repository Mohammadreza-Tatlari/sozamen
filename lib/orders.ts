export const orderStatuses = {
  paid: "پرداخت شده",
  processing: "در حال آماده‌سازی",
  done: "تکمیل شده",
  cancelled: "لغو شده",
  "fake-failed": "پرداخت ناموفق",
  pending: "در انتظار پرداخت",
} as const;

const legacyOrderStatusLabels: Record<string, string> = {
  process: "در حال آماده‌سازی",
  "in-progress": "در حال آماده‌سازی",
  completed: "تکمیل شده",
  failed: "پرداخت ناموفق",
};

export const orderStatusLabel = (status: string) =>
  orderStatuses[status as keyof typeof orderStatuses] ||
  legacyOrderStatusLabels[status] ||
  "وضعیت نامشخص";
