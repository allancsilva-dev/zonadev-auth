import { IsNotEmpty, IsString, IsEnum, IsOptional, IsBoolean, Matches } from 'class-validator';
import { PlanType } from '../../../common/enums/plan-type.enum';

export class CreateTenantDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'Subdomínio deve conter apenas letras minúsculas, números e hífens' })
  subdomain: string;

  @IsOptional()
  @IsEnum(PlanType)
  plan?: PlanType;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
