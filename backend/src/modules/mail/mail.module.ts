import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { resolve } from 'path';
import { MailService } from './mail.service';

@Module({
  imports: [
    MailerModule.forRootAsync({
      useFactory: () => {
        const rawPort = Number(process.env.MAIL_PORT);
        const port = rawPort > 0 ? rawPort : 587;

        return {
          transport: {
            host: process.env.MAIL_HOST ?? 'smtp.example.com',
            port,
            secure: port === 465,
            auth: {
              user: process.env.MAIL_USER,
              pass: process.env.MAIL_PASS,
            },
          },
          defaults: {
            from: process.env.MAIL_FROM ?? 'ZonaDev Auth <noreply@zonadev.tech>',
          },
          template: {
            dir: resolve(__dirname, 'templates'),
            adapter: new HandlebarsAdapter(),
            options: {
              strict: true,
            },
          },
        };
      },
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
