import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from './common/decorators/current-user.decorator';
import { Public } from './common/decorators/public.decorator';
import type { AuthUser } from './common/types/auth-request';

@Controller('dev-check')
export class DevCheckController {
  @Get('me') me(@CurrentUser() user: AuthUser) { return user; }
  @Get('id') id(@CurrentUser('id') id: string) { return { id }; }
  @Public() @Get('open') open() { return { open: true }; }
}