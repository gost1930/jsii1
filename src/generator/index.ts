import { addModel, getModels } from './scaffold';
import type { ModelDefinition } from './types';

const user: ModelDefinition = {
  name: 'User',
  fields: [
    { name: 'id', type: 'Int', isId: true, isRequired: true, defaultValue: 'autoincrement' },
    { name: 'email', type: 'String', isRequired: true, isUnique: true },
    { name: 'name', type: 'String', isOptional: true },
    { name: 'role', type: 'String', isRequired: true, hasDefault: true, defaultValue: '"USER"' },
    { name: 'active', type: 'Boolean', isRequired: true, hasDefault: true, defaultValue: 'true' },
    { name: 'createdAt', type: 'DateTime', isRequired: true, hasDefault: true, defaultValue: 'now()' },
    { name: 'updatedAt', type: 'DateTime', isRequired: true, hasDefault: true, defaultValue: 'now()' },
  ],
};

const post: ModelDefinition = {
  name: 'Post',
  fields: [
    { name: 'id', type: 'Int', isId: true, isRequired: true, defaultValue: 'autoincrement' },
    { name: 'title', type: 'String', isRequired: true },
    { name: 'body', type: 'String', isOptional: true },
    { name: 'createdAt', type: 'DateTime', isRequired: true, hasDefault: true, defaultValue: 'now()' },
    { name: 'author', type: 'String', isRequired: false, relation: { type: 'belongsTo', model: 'User' } },
  ],
};

(async () => {
  await addModel(user);
  await addModel(post);

  const models = await getModels();
  console.log(`\nActive models: ${models.map((m) => m.name).join(', ')}`);
  console.log('Post.author belongsTo User → auto-generated posts[] on User');
})();
