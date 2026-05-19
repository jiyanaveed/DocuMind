import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ChatMessageDto } from './dto/chat-message.dto';
import { ChatService } from './chat.service';

interface AuthUser {
  userId: string;
  email: string;
}

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('message')
  sendMessage(@Body() dto: ChatMessageDto, @CurrentUser() user: AuthUser) {
    return this.chatService.sendMessage(user.userId, dto);
  }

  @Get('conversations')
  listConversations(@CurrentUser() user: AuthUser) {
    return this.chatService.listConversations(user.userId);
  }

  @Get('conversations/:id/messages')
  getMessages(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.chatService.getMessages(id, user.userId);
  }
}
