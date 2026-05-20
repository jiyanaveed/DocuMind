import { Body, Controller, Get, Header, Param, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
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

  @Post('message/stream')
  @Header('Content-Type', 'text/event-stream')
  @Header('Cache-Control', 'no-cache')
  @Header('Connection', 'keep-alive')
  async streamMessage(
    @Body() dto: ChatMessageDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    res.flushHeaders();

    let conversationId = dto.conversation_id ?? '';

    try {
      let fullContent = '';
      for await (const chunk of this.chatService.streamMessage(
        user.userId,
        dto,
        (id) => { conversationId = id; },
      )) {
        fullContent += chunk;
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
      }

      res.write(
        `data: ${JSON.stringify({ done: true, conversation_id: conversationId, source_chunks: [] })}\n\n`,
      );
    } catch (err) {
      res.write(`data: ${JSON.stringify({ error: (err as Error).message })}\n\n`);
    } finally {
      res.end();
    }
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
