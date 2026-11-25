import { Body, Controller, Delete, Get, Patch, Post } from '@nestjs/common';
import { Permission } from '../../common/constants/permissions';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentFamilyMembership } from '../../common/decorators/current-family-membership.decorator';
import { FamilyScoped } from '../../common/decorators/family-scoped.decorator';
import type { FamilyMembershipContext } from '../../common/types/family-membership-context.type';
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
  @FamilyScoped()
  @RequirePermissions(Permission.FAMILY_VIEW)
  @ApiGetFamily()
  get(@CurrentFamilyMembership() { family, role }: FamilyMembershipContext) {
    return { ...family, role };
  }

  @Patch(':familyId')
  @FamilyScoped()
  @RequirePermissions(Permission.FAMILY_UPDATE)
  @ApiUpdateFamily()
  update(
    @CurrentFamilyMembership() membership: FamilyMembershipContext,
    @Body() input: UpdateFamilyDto,
  ) {
    return this.families.update(membership, input);
  }

  @Delete(':familyId')
  @FamilyScoped()
  @RequirePermissions(Permission.FAMILY_ARCHIVE)
  @ApiArchiveFamily()
  archive(@CurrentFamilyMembership() membership: FamilyMembershipContext) {
    return this.families.archive(membership);
  }
}
