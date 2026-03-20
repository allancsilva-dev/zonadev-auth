import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAppDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  domain?: string;

  @IsOptional()
  @IsString()
  baseUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  audience?: string;

  @IsOptional()
  @IsString()
  allowOrigin?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
