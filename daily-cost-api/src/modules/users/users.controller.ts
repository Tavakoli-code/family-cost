import { Body, Controller, Get, Patch } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiGetMe, ApiUpdateMe, ApiUsersController } from './docs/users.docs';
import { UpdateMeDto } from './dto/update-me.dto';
import { UsersService } from './users.service';

@ApiUsersController()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiGetMe()
  getMe(@CurrentUser('id') id: string) {
    return this.users.getMe(id);
  }

  @Patch('me')
  @ApiUpdateMe()
  updateMe(@CurrentUser('id') id: string, @Body() update: UpdateMeDto) {
    return this.users.updateMe(id, update);
  }
}
