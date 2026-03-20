import { IsNotEmpty, IsString, IsEnum, IsOptional, IsBoolean, Matches, IsUUID, IsEmail } from 'class-validator';
import { PlanType } from '../../../common/enums/plan-type.enum';

export class CreateTenantDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^(?!-)[a-z0-9-]{3,30}(?<!-)$/, {
    message:
      'Subdomínio deve ter 3-30 caracteres, apenas letras minúsculas, números e hífens, sem começar ou terminar com hífen',
  })
  subdomain: string;

  @IsOptional()
  @IsEnum(PlanType)
  plan?: PlanType;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsNotEmpty()
  @IsUUID()
  ownerAuthUserId: string;

  @IsNotEmpty()
  @IsEmail()
  ownerEmail: string;
}
