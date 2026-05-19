import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { DocumentsService } from './documents.service';

interface AuthUser {
  userId: string;
  email: string;
}

@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly embeddingsService: EmbeddingsService,
  ) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.documentsService.findAll(user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.documentsService.findOne(id, user.userId);
  }

  @Post()
  async create(@Body() dto: CreateDocumentDto, @CurrentUser() user: AuthUser) {
    const doc = await this.documentsService.create(user.userId, dto);
    this.embeddingsService.processDocument(doc);
    return doc;
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
    @CurrentUser() user: AuthUser,
  ) {
    const doc = await this.documentsService.update(id, user.userId, dto);
    this.embeddingsService.processDocument(doc);
    return doc;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.documentsService.remove(id, user.userId);
  }
}
