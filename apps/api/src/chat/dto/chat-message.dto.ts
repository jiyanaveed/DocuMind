import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class ChatMessageDto {
  @IsString()
  @IsNotEmpty()
  message: string;

  @IsUUID()
  @IsOptional()
  conversation_id?: string;
}
