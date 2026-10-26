import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateTaskDto } from './update-task.dto';

describe('UpdateTaskDto', () => {
  it('does not inject default status/priority into a partial update', () => {
    const dto = plainToInstance(UpdateTaskDto, { status: 'DONE' });

    expect(dto.status).toBe('DONE');
    expect(dto.priority).toBeUndefined();
  });

  it('leaves both undefined when only the assignee changes', () => {
    const dto = plainToInstance(UpdateTaskDto, { assigneeId: null });

    expect(dto.status).toBeUndefined();
    expect(dto.priority).toBeUndefined();
  });

  it('still validates status and priority values', async () => {
    const errors = await validate(plainToInstance(UpdateTaskDto, { status: 'BLOCKED', priority: 'CRITICAL' }));

    expect(errors.map((e) => e.property).sort()).toEqual(['priority', 'status']);
  });
});
