import { IsString, IsNumber, IsPositive, IsNotEmpty, Min, IsOptional, IsObject } from 'class-validator';

export class CreatePlanDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  price: number;

  @IsNumber()
  @Min(1)
  maxUsers: number;

  @IsOptional()
  @IsObject()
  features?: Record<string, any>;
}
