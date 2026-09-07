import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { CopilotCommandRequest } from '../timer/dto';
import { CopilotService } from './copilot.service';

@Controller('copilot')
export class CopilotController {
  constructor(private readonly copilot: CopilotService) {}

  @Post('commands')
  @HttpCode(200)
  async run(@Body() body: CopilotCommandRequest) {
    return this.copilot.run(body.utterance, body.userId);
  }
}
