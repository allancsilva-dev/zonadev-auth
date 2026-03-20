import { IsEmail, IsNotEmpty, IsUUID } from 'class-validator';

export class ReprovisionTenantDto {
  @IsNotEmpty()
  @IsUUID()
  ownerAuthUserId: string;

  @IsNotEmpty()
  @IsEmail()
  ownerEmail: string;
}
