import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { DatabaseService } from '../database/database.service';

interface AuthUser {
  userId: string;
  email: string;
}

interface UsageRow {
  total_requests: string;
  total_prompt_tokens: string;
  total_completion_tokens: string;
  total_tokens: string;
  model: string;
  date: string;
}

@UseGuards(JwtAuthGuard)
@Controller('usage')
export class UsageController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  getUsage(@CurrentUser() user: AuthUser) {
    return this.db.query<UsageRow>(
      `SELECT
         COUNT(*)::int            AS total_requests,
         SUM(prompt_tokens)::int  AS total_prompt_tokens,
         SUM(completion_tokens)::int AS total_completion_tokens,
         SUM(total_tokens)::int   AS total_tokens,
         model,
         DATE(created_at)         AS date
       FROM token_usage
       WHERE user_id = $1
       GROUP BY model, DATE(created_at)
       ORDER BY date DESC
       LIMIT 30`,
      [user.userId],
    );
  }
}
