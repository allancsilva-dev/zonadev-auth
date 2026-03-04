import { IsUUID, IsDateString, IsOptional } from 'class-validator';

export class CreateSubscriptionDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsUUID()
  planId: string;

  @IsDateString()
  expiresAt: string;
}
