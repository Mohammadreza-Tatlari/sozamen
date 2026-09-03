export interface OTPProvider { send(phone:string): Promise<void>; verify(phone:string, code:string): Promise<boolean> }
export class MockOTPProvider implements OTPProvider {
  async send(){ return; }
  async verify(_phone:string, code:string){ return /^\d{4,6}$/.test(code); }
}
export const otpProvider = new MockOTPProvider();
