import { Body, Controller, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiCreateFamily, ApiFamiliesController } from './docs/families.docs';
import { CreateFamilyDto } from './dto/create-family.dto';
import { FamiliesService } from './families.service';

@ApiFamiliesController()
@Controller('families')
export class FamiliesController {
  constructor(private readonly families: FamiliesService) {}

  @Post()
  @ApiCreateFamily()
  create(@CurrentUser('id') ownerId: string, @Body() input: CreateFamilyDto) {
    return this.families.create(ownerId, input);
  }
}
