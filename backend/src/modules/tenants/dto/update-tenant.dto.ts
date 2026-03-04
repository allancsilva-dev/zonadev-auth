import { IsString, IsEnum, IsOptional, IsBoolean } from 'class-validator';
import { PlanType } from '../../../common/enums/plan-type.enum';

export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(PlanType)
  plan?: PlanType;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
