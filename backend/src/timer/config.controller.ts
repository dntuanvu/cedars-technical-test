import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { TimerConfigDto } from './dto';
import { TimerService } from './timer.service';

@Controller('users')
export class ConfigController {
  constructor(private readonly timer: TimerService) {}

  @Get(':userId/config')
  async get(@Param('userId') userId: string) {
    return this.timer.getConfig(userId);
  }

  @Put(':userId/config')
  async update(@Param('userId') userId: string, @Body() body: TimerConfigDto) {
    return this.timer.updateConfig(userId, body);
  }
}
