import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayloadUser } from '../common/decorators/current-user.decorator';

@ApiTags('Organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new organization (Creator becomes OWNER)' })
  @ApiResponse({ status: 201, description: 'Organization successfully created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Organization slug already exists' })
  async createOrganization(
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: CreateOrganizationDto,
  ) {
    return this.organizationsService.createOrganization(user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all organizations the authenticated user belongs to' })
  @ApiResponse({ status: 200, description: 'List of user organizations retrieved' })
  async getUserOrganizations(@CurrentUser() user: JwtPayloadUser) {
    return this.organizationsService.getUserOrganizations(user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get organization details by ID' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiResponse({ status: 200, description: 'Organization details retrieved' })
  @ApiResponse({ status: 403, description: 'User is not a member of this organization' })
  async getOrganizationById(
    @CurrentUser() user: JwtPayloadUser,
    @Param('id') orgId: string,
  ) {
    return this.organizationsService.getOrganizationById(user.userId, orgId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update organization details (Requires OWNER or ADMIN role)' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiResponse({ status: 200, description: 'Organization successfully updated' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async updateOrganization(
    @CurrentUser() user: JwtPayloadUser,
    @Param('id') orgId: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizationsService.updateOrganization(user.userId, orgId, dto);
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'List members of an organization' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiResponse({ status: 200, description: 'List of organization members retrieved' })
  @ApiResponse({ status: 403, description: 'User is not a member of this organization' })
  async getMembers(
    @CurrentUser() user: JwtPayloadUser,
    @Param('id') orgId: string,
  ) {
    return this.organizationsService.getMembers(user.userId, orgId);
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Add a new member to the organization (Requires OWNER or ADMIN role)' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiResponse({ status: 201, description: 'Member successfully added' })
  @ApiResponse({ status: 404, description: 'User with provided email not found' })
  @ApiResponse({ status: 409, description: 'User is already a member' })
  async addMember(
    @CurrentUser() user: JwtPayloadUser,
    @Param('id') orgId: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.organizationsService.addMember(user.userId, orgId, dto);
  }

  @Patch(':id/members/:memberId')
  @ApiOperation({ summary: 'Update member role (Requires OWNER or ADMIN role)' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiParam({ name: 'memberId', description: 'Membership ID' })
  @ApiResponse({ status: 200, description: 'Member role successfully updated' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async updateMemberRole(
    @CurrentUser() user: JwtPayloadUser,
    @Param('id') orgId: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.organizationsService.updateMemberRole(user.userId, orgId, memberId, dto);
  }

  @Delete(':id/members/:memberId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a member from organization (Requires OWNER/ADMIN or Self)' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiParam({ name: 'memberId', description: 'Membership ID' })
  @ApiResponse({ status: 200, description: 'Member successfully removed' })
  @ApiResponse({ status: 400, description: 'Cannot remove sole OWNER' })
  async removeMember(
    @CurrentUser() user: JwtPayloadUser,
    @Param('id') orgId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.organizationsService.removeMember(user.userId, orgId, memberId);
  }

  @Post(':id/switch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Switch active tenant session and receive tenant-scoped tokens' })
  @ApiParam({ name: 'id', description: 'Organization ID to switch to' })
  @ApiResponse({ status: 200, description: 'Successfully switched active organization context' })
  @ApiResponse({ status: 403, description: 'User is not a member of target organization' })
  async switchTenant(
    @CurrentUser() user: JwtPayloadUser,
    @Param('id') orgId: string,
  ) {
    return this.organizationsService.switchTenant(user.userId, orgId);
  }
}
