import type { DigestPayload, MailSender } from '../types.js';
import { withRetry } from '../utils/retry.js';

export class ResendMailSender implements MailSender {
  constructor(
    private readonly apiKey: string,
    private readonly emailFrom: string,
    private readonly emailTo: string,
  ) {}

  async sendDigest(payload: DigestPayload): Promise<void> {
    await sendResendEmail({
      apiKey: this.apiKey,
      from: this.emailFrom,
      to: this.emailTo,
      subject: payload.subject,
      text: payload.text,
    });
  }
}

export async function sendResendEmail(options: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  await withRetry(async () => {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: options.from,
        to: options.to,
        subject: options.subject,
        text: options.text,
      }),
      signal: AbortSignal.timeout(3000),
    });

    const body = await response.text();
    if (!response.ok) {
      throw new Error(`Resend send failed: ${body}`);
    }
  });
}
