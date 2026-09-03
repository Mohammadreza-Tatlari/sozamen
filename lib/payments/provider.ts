export type PaymentResult = { success: boolean; reference: string };
export interface PaymentProvider {
  pay(amount: number): Promise<PaymentResult>;
}
export class MockPaymentProvider implements PaymentProvider {
  async pay(_amount: number) {
    return { success: true, reference: `SZ-${Date.now()}` };
  }
}
export const paymentProvider: PaymentProvider = new MockPaymentProvider();
