import { IsEmail, IsNotEmpty, IsString, IsOptional, IsUrl } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'E-mail inválido' })
  email: string;

  @IsNotEmpty({ message: 'Senha obrigatória' })
  @IsString()
  password: string;

  /**
   * Audiência (audience) do token JWT — sistema cliente que iniciou o fluxo SSO.
    * Validado contra tabela apps (cache in-memory).
   */
  @IsNotEmpty({ message: 'Audience obrigatório' })
  @IsString()
  aud: string;

  /**
   * URL de redirect após login bem-sucedido.
   * Validada com isSafeRedirect() no backend — apenas *.zonadev.tech aceito.
   */
  @IsOptional()
  @IsString()
  redirect?: string;
}
