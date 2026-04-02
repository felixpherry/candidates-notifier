import { Resend } from 'resend';

import type { DigestPayload, MailSender } from '../types.js';
import { withRetry } from '../utils/retry.js';

export class ResendMailSender implements MailSender {
  private readonly resend: Resend;

  constructor(
    apiKey: string,
    private readonly emailFrom: string,
    private readonly emailTo: string,
  ) {
    this.resend = new Resend(apiKey);
  }

  async sendDigest(payload: DigestPayload): Promise<void> {
    await withRetry(async () => {
      const result = await this.resend.emails.send({
        from: this.emailFrom,
        to: this.emailTo,
        subject: payload.subject,
        text: payload.text,
      });

      if (result.error) {
        throw new Error(`Resend send failed: ${result.error.message}`);
      }
    });
  }
}
