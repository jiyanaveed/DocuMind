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
        'Unsupported file type. Please upload a PDF (.pdf) or Word document (.doc, .docx).',
      );
    }

    const title = file.originalname.replace(/\.[^/.]+$/, '');

    try {
      if (file.mimetype === 'application/pdf') {
        const data = await pdfParse(file.buffer);
        return { title, text: data.text };
      }

      const result = await mammoth.extractRawText({ buffer: file.buffer });
      return { title, text: result.value };
    } catch {
      throw new InternalServerErrorException('Failed to extract text from file');
    }
  }
}
