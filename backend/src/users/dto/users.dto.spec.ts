import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateProfileDto } from './update-profile.dto';
import { ChangePasswordDto } from './change-password.dto';

// Mirrors the global ValidationPipe options in main.ts
const validateDto = async (cls: any, body: Record<string, unknown>) => {
  const instance = plainToInstance(cls, body, { enableImplicitConversion: true });
  const errors = await validate(instance as object, { whitelist: true, forbidNonWhitelisted: true });
  return { instance, errors, fields: errors.map((e) => e.property) };
};

describe('UpdateProfileDto', () => {
  it('rejects attempts to target another user or tenant (id, tenantId, email)', async () => {
    const { fields } = await validateDto(UpdateProfileDto, {
      id: 'user-b',
      tenantId: 'org-b',
      email: 'b@tenantflow.com',
      name: 'Hijack',
    });

    expect(fields).toEqual(expect.arrayContaining(['id', 'tenantId', 'email']));
  });

  it('rejects passwordHash in the body', async () => {
    const { fields } = await validateDto(UpdateProfileDto, { passwordHash: 'x' });
    expect(fields).toContain('passwordHash');
  });

  it('trims the name', async () => {
    const { instance, errors } = await validateDto(UpdateProfileDto, { name: '  Jane Doe  ' });
    expect(errors).toHaveLength(0);
    expect((instance as UpdateProfileDto).name).toBe('Jane Doe');
  });

  it('rejects a whitespace-only name', async () => {
    const { fields } = await validateDto(UpdateProfileDto, { name: '   ' });
    expect(fields).toContain('name');
  });

  it('rejects a name longer than 100 characters', async () => {
    const { fields } = await validateDto(UpdateProfileDto, { name: 'a'.repeat(101) });
    expect(fields).toContain('name');
  });

  it.each(['http://cdn.example.com/a.png', 'javascript:alert(1)', 'data:image/png;base64,AAAA', 'not a url'])(
    'rejects avatarUrl %s',
    async (avatarUrl) => {
      const { fields } = await validateDto(UpdateProfileDto, { avatarUrl });
      expect(fields).toContain('avatarUrl');
    },
  );

  it('accepts an https avatarUrl and null', async () => {
    expect((await validateDto(UpdateProfileDto, { avatarUrl: 'https://cdn.example.com/a.png' })).errors).toHaveLength(0);
    expect((await validateDto(UpdateProfileDto, { avatarUrl: null })).errors).toHaveLength(0);
  });
});

describe('ChangePasswordDto', () => {
  it('rejects new passwords shorter than 8 or longer than 72 characters', async () => {
    expect((await validateDto(ChangePasswordDto, { currentPassword: 'x', newPassword: 'a'.repeat(7) })).fields).toContain(
      'newPassword',
    );
    expect((await validateDto(ChangePasswordDto, { currentPassword: 'x', newPassword: 'a'.repeat(73) })).fields).toContain(
      'newPassword',
    );
  });

  it('accepts 8 and 72 character passwords', async () => {
    expect((await validateDto(ChangePasswordDto, { currentPassword: 'x', newPassword: 'a'.repeat(8) })).errors).toHaveLength(0);
    expect((await validateDto(ChangePasswordDto, { currentPassword: 'x', newPassword: 'a'.repeat(72) })).errors).toHaveLength(0);
  });

  it('requires currentPassword', async () => {
    const { fields } = await validateDto(ChangePasswordDto, { newPassword: 'NewPassw0rd' });
    expect(fields).toContain('currentPassword');
  });
});
