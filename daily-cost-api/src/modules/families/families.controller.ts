import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  ApiArchiveFamily,
  ApiCreateFamily,
  ApiFamiliesController,
  ApiGetFamily,
  ApiListFamilies,
  ApiUpdateFamily,
} from './docs/families.docs';
import { CreateFamilyDto } from './dto/create-family.dto';
import { UpdateFamilyDto } from './dto/update-family.dto';
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

  @Get()
  @ApiListFamilies()
  list(@CurrentUser('id') userId: string) {
    return this.families.list(userId);
  }

  @Get(':familyId')
  @ApiGetFamily()
  get(
    @CurrentUser('id') userId: string,
    @Param('familyId', ParseUUIDPipe) familyId: string,
  ) {
    return this.families.get(userId, familyId);
  }

  @Patch(':familyId')
  @ApiUpdateFamily()
  update(
    @CurrentUser('id') userId: string,
    @Param('familyId', ParseUUIDPipe) familyId: string,
    @Body() input: UpdateFamilyDto,
  ) {
    return this.families.update(userId, familyId, input);
  }

  @Delete(':familyId')
  @ApiArchiveFamily()
  archive(
    @CurrentUser('id') userId: string,
    @Param('familyId', ParseUUIDPipe) familyId: string,
  ) {
    return this.families.archive(userId, familyId);
  }
}
