import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ManageAppAccessDto {
  @IsNotEmpty()
  @IsString()
  appSlug: string;

  @IsNotEmpty()
  @IsIn(['grant', 'revoke'])
  action: 'grant' | 'revoke';

  @IsOptional()
  @IsString()
  defaultRole?: string;
}
