import { IsString, IsNumber, IsPositive, Min, IsOptional, IsObject, IsNotEmpty } from 'class-validator';

export class UpdatePlanDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  price?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxUsers?: number;

  @IsOptional()
  @IsObject()
  features?: Record<string, any>;
}
