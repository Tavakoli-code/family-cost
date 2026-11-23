import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';
import { SkipResponseWrap } from '../../common/decorators/skip-response-wrap.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ApiHealthController } from './docs/health.docs';

@ApiHealthController()
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  @SkipResponseWrap()
  check() {
    return this.healthService.check();
  }
}
