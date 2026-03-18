import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAppDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  slug: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  audience: string;

  @IsNotEmpty()
  @IsString()
  allowOrigin: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
