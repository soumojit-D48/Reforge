import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { ProjectAccessGuard } from '../common/guards/project-access.guard.js';
import { ProjectAccess } from '../common/decorators/project-access.decorator.js';
import { AddSuiteTestDto } from './dto/add-suite-test.dto.js';
import { CreateRegressionTestDto } from './dto/create-regression-test.dto.js';
import { CreateTestSuiteDto } from './dto/create-test-suite.dto.js';
import { RunTestSuiteDto } from './dto/run-test-suite.dto.js';
import { UpdateRegressionTestDto } from './dto/update-regression-test.dto.js';
import { RegressionService } from './regression.service.js';

@ApiTags('regression')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ProjectAccessGuard)
@Controller()
export class RegressionController {
  constructor(private readonly regression: RegressionService) {}

  @ProjectAccess('admin', 'developer')
  @Post('projects/:projectId/regression-tests')
  createTest(@Param('projectId') projectId: string, @Body() dto: CreateRegressionTestDto) { return this.regression.createTest(projectId, dto); }

  @ProjectAccess()
  @Get('projects/:projectId/regression-tests')
  listTests(@Param('projectId') projectId: string) { return this.regression.listTests(projectId); }

  @ProjectAccess()
  @Get('regression-tests/:testId')
  getTest(@Param('testId') testId: string) { return this.regression.getTest(testId); }

  @ProjectAccess('admin', 'developer')
  @Patch('regression-tests/:testId')
  updateTest(@Param('testId') testId: string, @Body() dto: UpdateRegressionTestDto) { return this.regression.updateTest(testId, dto); }

  @ProjectAccess('admin', 'developer')
  @Delete('regression-tests/:testId')
  deleteTest(@Param('testId') testId: string): Promise<void> { return this.regression.deleteTest(testId); }

  @ProjectAccess('admin', 'developer')
  @Post('projects/:projectId/test-suites')
  createSuite(@Param('projectId') projectId: string, @Body() dto: CreateTestSuiteDto) { return this.regression.createSuite(projectId, dto); }

  @ProjectAccess()
  @Get('projects/:projectId/test-suites')
  listSuites(@Param('projectId') projectId: string) { return this.regression.listSuites(projectId); }

  @ProjectAccess()
  @Get('test-suites/:suiteId')
  getSuite(@Param('suiteId') suiteId: string) { return this.regression.getSuite(suiteId); }

  @ProjectAccess('admin', 'developer')
  @Post('test-suites/:suiteId/tests')
  addTest(@Param('suiteId') suiteId: string, @Body() dto: AddSuiteTestDto): Promise<void> { return this.regression.addTest(suiteId, dto.regressionTestId); }

  @ProjectAccess('admin', 'developer')
  @Delete('test-suites/:suiteId/tests/:testId')
  removeTest(@Param('suiteId') suiteId: string, @Param('testId') testId: string): Promise<void> { return this.regression.removeTest(suiteId, testId); }

  @ProjectAccess('admin', 'developer')
  @Post('test-suites/:suiteId/run')
  runSuite(@Param('suiteId') suiteId: string, @Body() dto: RunTestSuiteDto) { return this.regression.createRun(suiteId, dto.promptVersion, dto.model); }

  @ProjectAccess()
  @Get('test-runs/:runId')
  getRun(@Param('runId') runId: string) { return this.regression.getRun(runId); }
}
