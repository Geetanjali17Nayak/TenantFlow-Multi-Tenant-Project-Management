import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { QueryActivityDto } from './query-activity.dto';

const errorsFor = async (input: Record<string, unknown>) => {
  const dto = plainToInstance(QueryActivityDto, input, { enableImplicitConversion: true });
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  return errors.map((e) => e.property);
};

describe('QueryActivityDto', () => {
  it('accepts a full valid query', async () => {
    expect(
      await errorsFor({
        page: '2',
        limit: '50',
        entity: 'Task',
        entityId: '3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b',
        actorId: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
        from: '2026-10-01T00:00:00Z',
        to: '2026-10-31T23:59:59Z',
      }),
    ).toEqual([]);
  });

  it.each([
    [{ limit: '101' }, 'limit'],
    [{ entity: 'Organization' }, 'entity'],
    [{ actorId: 'not-a-uuid' }, 'actorId'],
    [{ entityId: '123' }, 'entityId'],
    [{ from: 'yesterday' }, 'from'],
    [{ tenantId: '3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b' }, 'tenantId'],
  ])('rejects %j', async (input, property) => {
    expect(await errorsFor(input)).toContain(property);
  });
});
