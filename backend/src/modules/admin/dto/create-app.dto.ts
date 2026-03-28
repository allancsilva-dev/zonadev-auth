import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength, IsArray, IsUrl } from 'class-validator';

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
  domain: string;

  @IsNotEmpty()
  @IsString()
  baseUrl: string;

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
  
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  postLogoutRedirectUris?: string[];
}
