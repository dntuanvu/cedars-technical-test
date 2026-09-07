import { Body, Controller, Get, HttpCode, Patch, Post } from '@nestjs/common';
import { UserIdHeader } from '../common/user-id.decorator';
import { SessionActionRequest, StartSessionRequest } from './dto';
import { TimerService } from './timer.service';

@Controller('sessions')
export class SessionsController {
  constructor(private readonly timer: TimerService) {}

  @Post()
  @HttpCode(201)
  async start(@Body() body: StartSessionRequest) {
    return this.timer.startSession(body.userId);
  }

  @Patch('current')
  async update(
    @UserIdHeader() userId: string,
    @Body() body: SessionActionRequest,
  ) {
    return this.timer.applyAction(userId, body.action);
  }

  @Get('current/status')
  async status(@UserIdHeader() userId: string) {
    return this.timer.getStatus(userId);
  }
}
