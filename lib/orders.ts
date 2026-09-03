export const orderStatuses={paid:"پرداخت شده",processing:"در حال آماده‌سازی",done:"تکمیل شده",cancelled:"لغو شده","fake-failed":"پرداخت ناموفق",pending:"در انتظار پرداخت"} as const;
export const orderStatusLabel=(status:string)=>orderStatuses[status as keyof typeof orderStatuses]||status;
