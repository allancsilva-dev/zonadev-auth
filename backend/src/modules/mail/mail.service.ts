import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly mailerService: MailerService) {}

  async sendResetPassword(email: string, rawToken: string): Promise<void> {
    const domain = process.env.DOMAIN ?? 'zonadev.tech';
    const resetUrl = `https://auth.${domain}/reset-password?token=${rawToken}`;

    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'ZonaDev Auth — Recuperação de senha',
        template: 'reset-password',
        context: {
          resetUrl,
          expiresIn: '1 hora',
        },
      });
    } catch (err) {
      this.logger.error(`Falha ao enviar e-mail de reset para ${email}: ${err}`);
      // Não relançar — não revelar falha de entrega ao cliente
    }
  }

  async sendVerifyEmail(email: string, rawToken: string): Promise<void> {
    const domain = process.env.DOMAIN ?? 'zonadev.tech';
    const verifyUrl = `https://auth.${domain}/auth/verify-email?token=${rawToken}`;

    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'ZonaDev Auth — Verificação de e-mail',
        template: 'verify-email',
        context: {
          verifyUrl,
        },
      });
    } catch (err) {
      this.logger.error(`Falha ao enviar e-mail de verificação para ${email}: ${err}`);
    }
  }
}
