import {
  BadRequestException,
  Controller,
  InternalServerErrorException,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as mammoth from 'mammoth';
import pdfParse = require('pdf-parse');
import { JwtAuthGuard } from '../auth/auth.guard';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);

@UseGuards(JwtAuthGuard)
@Controller('upload')
export class UploadController {
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        'Unsupported file type. Please upload a PDF, Word document, or plain text file.',
      );
    }

    const title = file.originalname.replace(/\.[^/.]+$/, '');

    const sanitizeText = (text: string): string =>
      text
        .replace(/\x00/g, '')
        .replace(/[\x01-\x08]/g, '')
        .replace(/[\x0B\x0C]/g, '')
        .replace(/[\x0E-\x1F]/g, '')
        .trim();

    try {
      if (file.mimetype === 'text/plain') {
        return { title, text: sanitizeText(file.buffer.toString('utf-8')) };
      }

      if (file.mimetype === 'application/pdf') {
        const data = await pdfParse(file.buffer);
        return { title, text: sanitizeText(data.text) };
      }

      const result = await mammoth.extractRawText({ buffer: file.buffer });
      return { title, text: sanitizeText(result.value) };
    } catch {
      throw new InternalServerErrorException('Failed to extract text from file');
    }
  }
}
