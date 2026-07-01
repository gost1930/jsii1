import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ModelDefinition } from './types';
import { prismaTypeToTs, zodType, findDisplayName, isFileField } from './types';
import { EXPORT_DIR, overwriteFile } from './writer';
import { camelCase, editableFields, plural, searchableFields } from '../utils/fnHelpers';



export const FrontendGenerator = {
  bootstrap() {
    overwriteFile(path.join(EXPORT_DIR, 'client', 'package.json'), FrontendGenerator.packageJson());
    overwriteFile(path.join(EXPORT_DIR, 'client', 'index.html'), FrontendGenerator.indexHtml());
    overwriteFile(path.join(EXPORT_DIR, 'client', 'vite.config.ts'), FrontendGenerator.viteConfig());
    overwriteFile(path.join(EXPORT_DIR, 'client', 'tsconfig.json'), FrontendGenerator.tsconfig());
    overwriteFile(path.join(EXPORT_DIR, 'client', 'tsconfig.app.json'), FrontendGenerator.tsconfigApp());
    overwriteFile(path.join(EXPORT_DIR, 'client', 'tsconfig.node.json'), FrontendGenerator.tsconfigNode());
    overwriteFile(path.join(EXPORT_DIR, 'client', '.env'), 'VITE_API_URL=http://localhost:3000/api');
    overwriteFile(path.join(EXPORT_DIR, 'client', 'src', 'main.tsx'), FrontendGenerator.main());
    overwriteFile(path.join(EXPORT_DIR, 'client', 'src', 'App.tsx'), FrontendGenerator.app());
    overwriteFile(path.join(EXPORT_DIR, 'client', 'src', 'index.css'), FrontendGenerator.indexCss());
    overwriteFile(path.join(EXPORT_DIR, 'client', 'src', 'lib', 'utils.ts'), FrontendGenerator.libUtils());
    overwriteFile(path.join(EXPORT_DIR, 'client', 'src', 'lib', 'api.ts'), FrontendGenerator.libApi());
    overwriteFile(path.join(EXPORT_DIR, 'client', 'src', 'components', 'ui', 'button.tsx'), FrontendGenerator.uiButton());
    overwriteFile(path.join(EXPORT_DIR, 'client', 'src', 'components', 'ui', 'input.tsx'), FrontendGenerator.uiInput());
    overwriteFile(path.join(EXPORT_DIR, 'client', 'src', 'components', 'ui', 'label.tsx'), FrontendGenerator.uiLabel());
    overwriteFile(path.join(EXPORT_DIR, 'client', 'src', 'components', 'ui', 'select.tsx'), FrontendGenerator.uiSelect());
    overwriteFile(path.join(EXPORT_DIR, 'client', 'src', 'components', 'ui', 'checkbox.tsx'), FrontendGenerator.uiCheckbox());
    overwriteFile(path.join(EXPORT_DIR, 'client', 'src', 'hooks', 'useUtils.ts'), FrontendGenerator.hooksUseUtils());
    overwriteFile(path.join(EXPORT_DIR, 'client', 'src', 'utils', 'api', 'client.ts'), FrontendGenerator.apiClient());
    overwriteFile(path.join(EXPORT_DIR, 'client', 'src', 'vite-env.d.ts'), FrontendGenerator.viteEnv());
  },

  generateAll(models: ModelDefinition[]) {
    FrontendGenerator.bootstrap();
    FrontendGenerator.cleanupStaleFiles(models);
    for (const model of models) {
      FrontendGenerator.generateModelFiles(model, models);
    }
  },

  cleanupStaleFiles(models: ModelDefinition[]) {
    const fe = path.join(EXPORT_DIR, 'client');
    const currentNames = new Set(models.map((m) => m.name));
    const currentPlural = new Set(models.map((m) => plural(camelCase(m.name))));

    // Clean stale pages directories
    const pagesDir = path.join(fe, 'src', 'pages');
    if (fs.existsSync(pagesDir)) {
      for (const dir of fs.readdirSync(pagesDir)) {
        if (!currentPlural.has(dir)) {
          try { fs.rmSync(path.join(pagesDir, dir), { recursive: true, force: true }); } catch {}
        }
      }
    }

    // Clean stale hook files
    const currentHooks = new Set<string>();
    for (const m of models) {
      currentHooks.add(`use${plural(m.name)}.ts`);
      currentHooks.add(`use${m.name}.ts`);
      currentHooks.add(`useCreate${m.name}.ts`);
      currentHooks.add(`useUpdate${m.name}.ts`);
      currentHooks.add(`useDelete${m.name}.ts`);
      currentHooks.add(`useBulkDelete${m.name}.ts`);
    }
    const hooksDir = path.join(fe, 'src', 'hooks');
    if (fs.existsSync(hooksDir)) {
      for (const file of fs.readdirSync(hooksDir)) {
        if (file.endsWith('.ts') && !currentHooks.has(file) && file !== 'useUtils.ts') {
          try { fs.unlinkSync(path.join(hooksDir, file)); } catch {}
        }
      }
    }

    // Clean stale schema files
    const currentCamel = new Set(models.map((m) => camelCase(m.name)));
    const schemasDir = path.join(fe, 'src', 'schemas');
    if (fs.existsSync(schemasDir)) {
      for (const file of fs.readdirSync(schemasDir)) {
        const basename = path.basename(file, path.extname(file));
        if (!currentCamel.has(basename)) {
          try { fs.unlinkSync(path.join(schemasDir, file)); } catch {}
        }
      }
    }

    // Clean stale api util files
    const apiDir = path.join(fe, 'src', 'utils', 'api');
    if (fs.existsSync(apiDir)) {
      for (const file of fs.readdirSync(apiDir)) {
        if (file === 'client.ts') continue;
        const basename = path.basename(file, path.extname(file));
        if (!currentCamel.has(basename)) {
          try { fs.unlinkSync(path.join(apiDir, file)); } catch {}
        }
      }
    }
  },

  generateModelFiles(model: ModelDefinition, allModels: ModelDefinition[]) {
    const mv = camelCase(model.name);
    const fe = path.join(EXPORT_DIR, 'client');

    overwriteFile(path.join(fe, 'src', 'pages', `${plural(mv)}`, 'index.tsx'), FrontendGenerator.pageIndex(model, allModels));
    overwriteFile(path.join(fe, 'src', 'pages', `${plural(mv)}`, 'create.tsx'), FrontendGenerator.pageCreate(model));
    overwriteFile(path.join(fe, 'src', 'pages', `${plural(mv)}`, 'edit', `${mv}.tsx`), FrontendGenerator.pageEdit(model));
    overwriteFile(path.join(fe, 'src', 'pages', `${plural(mv)}`, 'components', `form.tsx`), FrontendGenerator.formComponent(model, allModels));
    overwriteFile(path.join(fe, 'src', 'pages', `${plural(mv)}`, 'components', `table.tsx`), FrontendGenerator.tableComponent(model, allModels));
    overwriteFile(path.join(fe, 'src', 'pages', `${plural(mv)}`, 'components', `filter-bar.tsx`), FrontendGenerator.filterBar(model));
    overwriteFile(path.join(fe, 'src', 'utils', 'api', `${mv}.ts`), FrontendGenerator.apiModule(model));
    overwriteFile(path.join(fe, 'src', 'schemas', `${mv}.ts`), FrontendGenerator.schema(model, allModels));
    overwriteFile(path.join(fe, 'src', 'hooks', `use${plural(model.name)}.ts`), FrontendGenerator.hookList(model));
    overwriteFile(path.join(fe, 'src', 'hooks', `use${model.name}.ts`), FrontendGenerator.hookSingle(model));
    overwriteFile(path.join(fe, 'src', 'hooks', `useCreate${model.name}.ts`), FrontendGenerator.hookCreate(model));
    overwriteFile(path.join(fe, 'src', 'hooks', `useUpdate${model.name}.ts`), FrontendGenerator.hookUpdate(model));
    overwriteFile(path.join(fe, 'src', 'hooks', `useDelete${model.name}.ts`), FrontendGenerator.hookDelete(model));
    overwriteFile(path.join(fe, 'src', 'hooks', `useBulkDelete${model.name}.ts`), FrontendGenerator.hookBulkDelete(model));
  },

  packageJson() {
    return JSON.stringify({
      name: 'client', version: '0.0.0', private: true, type: 'module',
      scripts: { dev: 'vite', build: 'tsc -b && vite build', preview: 'vite preview' },
      dependencies: {
        react: '^19.0.0', 'react-dom': '^19.0.0', 'react-router-dom': '^7.3.0',
        '@tanstack/react-query': '^5.67.0', '@tanstack/react-table': '^8.21.0',
        'react-hook-form': '^7.54.0', '@hookform/resolvers': '^5.0.0',
        zod: '^3.24.0', clsx: '^2.1.1', 'tailwind-merge': '^3.2.0',
        'lucide-react': '^0.482.0', recharts: '^2.15.0',
      },
      devDependencies: {
        '@types/react': '^19.0.0', '@types/react-dom': '^19.0.0', '@vitejs/plugin-react': '^4.3.0',
        typescript: '~5.8.0', vite: '^6.2.0', 'tailwindcss': '^4.1.0', '@tailwindcss/vite': '^4.1.0',
      },
    }, null, 2);
  },

  indexHtml() {
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Agency</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
  },

  viteConfig() {
    return `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
`;
  },

  tsconfig() {
    return JSON.stringify({
      files: [], references: [
        { path: './tsconfig.app.json' },
        { path: './tsconfig.node.json' },
      ],
    }, null, 2);
  },

  tsconfigApp() {
    return JSON.stringify({
      compilerOptions: {
        target: 'ES2020', useDefineForClassFields: true, lib: ['ES2020', 'DOM', 'DOM.Iterable'],
        module: 'ESNext', skipLibCheck: true, moduleResolution: 'bundler',
        allowImportingTsExtensions: true, isolatedModules: true, moduleDetection: 'force',
        noEmit: true, jsx: 'react-jsx', strict: true, noUnusedLocals: true, noUnusedParameters: true,
        noFallthroughCasesInSwitch: true, noUncheckedIndexedAccess: true,
        types: ['vite/client'],
        baseUrl: '.', paths: { '@/*': ['src/*'] },
      },
      include: ['src'],
    }, null, 2);
  },

  tsconfigNode() {
    return JSON.stringify({
      compilerOptions: {
        target: 'ES2022', lib: ['ES2023'], module: 'ESNext', skipLibCheck: true,
        moduleResolution: 'bundler', allowImportingTsExtensions: true, isolatedModules: true,
        moduleDetection: 'force', noEmit: true, strict: true, noUnusedLocals: true,
        noUnusedParameters: true, noFallthroughCasesInSwitch: true, noUncheckedIndexedAccess: true,
      },
      include: ['vite.config.ts'],
    }, null, 2);
  },

  main() {
    return `import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.tsx';
import './index.css';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
`;
  },

  app() {
    return `import { Routes, Route } from 'react-router-dom';
${'/* pages will be injected by the generator */'}

function App() {
  return (
    <Routes>
      <Route path="/" element={<div>Welcome</div>} />
    </Routes>
  );
}

export default App;
`;
  },

  indexCss() {
    return `@import 'tailwindcss';
`;
  },

  libUtils() {
    return `import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
`;
  },

  libApi() {
    return `const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const api = {
  get: async <T>(path: string): Promise<T> => {
    const res = await fetch(\`\${BASE_URL}\${path}\`);
    if (!res.ok) throw new Error(\`GET \${path} failed: \${res.statusText}\`);
    return res.json();
  },
  post: async <T>(path: string, body: unknown): Promise<T> => {
    const res = await fetch(\`\${BASE_URL}\${path}\`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(\`POST \${path} failed: \${res.statusText}\`);
    return res.json();
  },
  put: async <T>(path: string, body: unknown): Promise<T> => {
    const res = await fetch(\`\${BASE_URL}\${path}\`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(\`PUT \${path} failed: \${res.statusText}\`);
    return res.json();
  },
  delete: async <T>(path: string): Promise<T> => {
    const res = await fetch(\`\${BASE_URL}\${path}\`, { method: 'DELETE' });
    if (!res.ok) throw new Error(\`DELETE \${path} failed: \${res.statusText}\`);
    return res.json();
  },
};
`;
  },

  uiButton() {
    return `import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
          variant === 'default' && 'bg-neutral-900 text-white hover:bg-neutral-800',
          variant === 'outline' && 'border border-neutral-200 bg-white hover:bg-neutral-100',
          variant === 'ghost' && 'hover:bg-neutral-100',
          size === 'sm' && 'px-3 py-1.5 text-sm',
          size === 'md' && 'px-4 py-2 text-sm',
          size === 'lg' && 'px-6 py-3 text-base',
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';
`;
  },

  uiInput() {
    return `import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
});
Input.displayName = 'Input';
`;
  },

  uiLabel() {
    return `import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export const Label = forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label ref={ref} className={cn('text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70', className)} {...props} />
  ),
);
Label.displayName = 'Label';
`;
  },

  uiSelect() {
    return `import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({ className, children, ...props }, ref) => {
  return (
    <select
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});
Select.displayName = 'Select';
`;
  },

  uiCheckbox() {
    return `import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(({ className, ...props }, ref) => {
  return (
    <input
      type="checkbox"
      ref={ref}
      className={cn(
        'h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-400',
        className,
      )}
      {...props}
    />
  );
});
Checkbox.displayName = 'Checkbox';
`;
  },

  hooksUseUtils() {
    return `import { useMemo } from 'react';
import { cn } from '@/lib/utils';

export function useUtils() {
  return useMemo(() => ({ cn }), []);
}
`;
  },

  viteEnv() {
    return `/// <reference types="vite/client" />
`;
  },

  apiClient() {
    return `const BASE_URL = import.meta.env.VITE_API_URL || '/api';

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(\`\${BASE_URL}\${path}\`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(\`\${method} \${path} failed: \${res.statusText}\`);
  return res.json();
}

export const apiClient = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};
`;
  },

  pageIndex(model: ModelDefinition, allModels: ModelDefinition[]) {
    const Mn = model.name;
    const mv = camelCase(model.name);
    return `import { ${Mn}Table } from './components/table';
import { ${Mn}FilterBar } from './components/filter-bar';
import { useState } from 'react';

export default function ${Mn}IndexPage() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">${plural(Mn)}</h1>
        <a
          href="/${plural(mv)}/create"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Create ${Mn}
        </a>
      </div>
      <${Mn}FilterBar filters={filters} onFiltersChange={setFilters} />
      <${Mn}Table filters={filters} sortBy={sortBy} sortOrder={sortOrder} onSortByChange={setSortBy} onSortOrderChange={setSortOrder} />
    </div>
  );
}
`;
  },

  pageCreate(model: ModelDefinition) {
    const Mn = model.name;
    const mv = camelCase(model.name);
    return `import { ${Mn}Form } from './components/form';

export default function Create${Mn}Page() {
  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">Create ${Mn}</h1>
      <${Mn}Form />
    </div>
  );
}
`;
  },

  pageEdit(model: ModelDefinition) {
    const Mn = model.name;
    const mv = camelCase(model.name);
    return `import { useParams } from 'react-router-dom';
import { use${Mn} } from '@/hooks/use${Mn}';
import { ${Mn}Form } from '../components/form';

export default function Edit${Mn}Page() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = use${Mn}(id!);

  if (isLoading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">Edit ${Mn}</h1>
      <${Mn}Form initialData={data} />
    </div>
  );
}
`;
  },

  filterBar(model: ModelDefinition) {
    const Mn = model.name;
    const mv = camelCase(model.name);
    const sFields = searchableFields(model.fields);
    if (!sFields.length) {
      return `import type { Dispatch, SetStateAction } from 'react';

interface Props {
  filters: Record<string, string>;
  onFiltersChange: Dispatch<SetStateAction<Record<string, string>>>;
}

export function ${Mn}FilterBar(_props: Props) {
  return null;
}
`;
    }
    return `import type { Dispatch, SetStateAction } from 'react';

interface Props {
  filters: Record<string, string>;
  onFiltersChange: Dispatch<SetStateAction<Record<string, string>>>;
}

export function ${Mn}FilterBar({ filters, onFiltersChange }: Props) {
  return (
    <div className="mb-4 flex flex-wrap gap-3">
${sFields.map((f) => `      <input
        placeholder="Filter by ${f.name}..."
        value={filters['${f.name}'] ?? ''}
        onChange={(e) => onFiltersChange((prev: any) => ({ ...prev, '${f.name}': e.target.value }))}
        className="h-9 rounded-md border border-neutral-200 bg-white px-3 text-sm placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-400"
      />`).join('\n')}
    </div>
  );
}
`;
  },

  formComponent(model: ModelDefinition, allModels: ModelDefinition[]) {
    const mv = camelCase(model.name);
    const Mn = model.name;
    const editFields = editableFields(model.fields).filter((f) => !f.relation);

    const belongsToRelations = model.fields.filter((f) => f.relation?.type === 'belongsTo');

    const hasInputFields = editFields.some((f) => !f.enumValues?.length && f.type !== 'Boolean' && !isFileField(f.name));
    const hasLabel = editFields.length > 0 || belongsToRelations.length > 0;

    const fieldInputs = editFields.map((f) => {
      const label = `        <Label htmlFor="${f.name}">${f.name}</Label>`;

      if (isFileField(f.name)) {
        return `      <div>
${label}
        <Input id="${f.name}" type="file" accept="image/*,.pdf,.doc,.docx" {...register('${f.name}')} />
        {errors.${f.name} && <p className="text-sm text-red-500">{errors.${f.name}.message}</p>}
      </div>`;
      }

      if (f.type === 'Boolean') {
        return `      <div className="flex items-center gap-2">
        <input type="checkbox" id="${f.name}" {...register('${f.name}')} className="h-4 w-4 rounded border-neutral-300" />
${label}
        {errors.${f.name} && <p className="text-sm text-red-500">{errors.${f.name}.message}</p>}
      </div>`;
      }

      if (f.enumValues?.length) {
        return `      <div>
${label}
        <select id="${f.name}" {...register('${f.name}')} className="flex h-10 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm">
          <option value="">Select...</option>
          ${f.enumValues.map((v) => `<option value="${v}">${v}</option>`).join('\n          ')}
        </select>
        {errors.${f.name} && <p className="text-sm text-red-500">{errors.${f.name}.message}</p>}
      </div>`;
      }

      return `      <div>
${label}
        <Input id="${f.name}" {...register('${f.name}')} />
        {errors.${f.name} && <p className="text-sm text-red-500">{errors.${f.name}.message}</p>}
      </div>`;
    }).join('\n');

    // belongsTo relational selects
    const relInputs = belongsToRelations.map((f) => {
      const target = allModels.find((m) => m.name === f.relation!.model);
      const displayName = target ? findDisplayName(target.fields) : 'id';
      const targetMv = target ? camelCase(target.name) : 'unknown';
      return `      <div>
        <Label htmlFor="${f.name}Id">${f.name}</Label>
        <select id="${f.name}Id" {...register('${f.name}Id')} className="flex h-10 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm">
          <option value="">Select ${f.relation!.model}...</option>
          {${targetMv}s?.data?.data?.map((item: any) => (
            <option key={item.id} value={item.id}>{item.${displayName}}</option>
          ))}
        </select>
        {errors.${f.name}Id && <p className="text-sm text-red-500">{errors.${f.name}Id.message}</p>}
      </div>`;
    }).join('\n');

    const relImports = belongsToRelations.map((f) => {
      const target = f.relation!.model;
      return `import { use${target}s } from '@/hooks/use${plural(target)}';`;
    }).join('\n');

    const relHooks = belongsToRelations.map((f) => {
      const targetMv = camelCase(f.relation!.model);
      return `  const { data: ${targetMv}s } = use${f.relation!.model}s();`;
    }).join('\n');

    const hasFields = editFields.length > 0 || belongsToRelations.length > 0;

    return `import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
${hasInputFields ? `import { Input } from '@/components/ui/input';
` : ''}${hasLabel ? `import { Label } from '@/components/ui/label';
` : ''}import { ${mv}Schema } from '@/schemas/${mv}';
import { useCreate${Mn} } from '@/hooks/useCreate${Mn}';
import { useUpdate${Mn} } from '@/hooks/useUpdate${Mn}';
${relImports}
import type { z } from 'zod';

type FormData = z.infer<typeof ${mv}Schema>;

interface Props {
  initialData?: any;
}

export function ${Mn}Form({ initialData }: Props) {
  const create = useCreate${Mn}();
  const update = useUpdate${Mn}();
  const isEditing = !!initialData;
${relHooks}
${hasFields ? `  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(${mv}Schema),
    defaultValues: initialData,
  });` : `  const { handleSubmit } = useForm<FormData>({
    resolver: zodResolver(${mv}Schema),
    defaultValues: initialData,
  });`}

  const onSubmit = (data: FormData) => {
    if (isEditing) update.mutate({ id: initialData.id, ...data });
    else create.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
${fieldInputs}
${relInputs}
      <Button type="submit">{isEditing ? 'Update' : 'Create'}</Button>
    </form>
  );
}
`;
  },

  tableComponent(model: ModelDefinition, allModels: ModelDefinition[]) {
    const Mn = model.name;
    const mv = camelCase(model.name);
    const displayFields = editableFields(model.fields).filter((f) => !f.relation).slice(0, 5);

    const belongsToFields = model.fields.filter((f) => f.relation?.type === 'belongsTo');

    const tableCellFields = displayFields.map((f) => {
      // belongsTo fields are in displayFields because they don't have relation prop (they have FK field)
      // The actual relation fields with relation.type='belongsTo' have relation set
      return `              <td className="whitespace-nowrap px-4 py-3 text-sm">{item.${f.name}}</td>`;
    }).join('\n');

    const belongsToCells = belongsToFields.map((f) => {
      const target = allModels.find((m) => m.name === f.relation!.model);
      const displayName = target ? findDisplayName(target.fields) : 'id';
      const fkName = `${f.name}Id`;
      return `              <td className="whitespace-nowrap px-4 py-3 text-sm">{item.${f.name}?.${displayName} ?? item.${fkName}}</td>`;
    }).join('\n');

    return `import { useState } from 'react';
import { use${Mn}s } from '@/hooks/use${plural(Mn)}';
import { useBulkDelete${Mn} } from '@/hooks/useBulkDelete${Mn}';
import { Link } from 'react-router-dom';

interface Props {
  filters?: Record<string, string>;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSortByChange?: (s: string) => void;
  onSortOrderChange?: (s: 'asc' | 'desc') => void;
}

export function ${Mn}Table({ filters = {}, sortBy = 'createdAt', sortOrder = 'desc', onSortByChange, onSortOrderChange }: Props) {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const { data, isLoading } = use${Mn}s({ page, limit: 10, sortBy, sortOrder, ...filters });
  const bulkDelete = useBulkDelete${Mn}();

  const pagination = (data as any)?.pagination ?? { page: 1, limit: 10, total: 0, totalPages: 1 };
  const items = (data as any)?.data ?? [];

  const toggleAll = () => {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((i: any) => i.id)));
  };

  const toggleOne = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleBulkDelete = () => {
    if (!selected.size) return;
    if (confirm(\`Delete \${selected.size} item(s)?\`)) {
      bulkDelete.mutate(Array.from(selected), { onSuccess: () => setSelected(new Set()) });
    }
  };

  const handleSort = (field: string) => {
    if (onSortByChange) onSortByChange(field);
    if (onSortOrderChange) onSortOrderChange(sortBy === field && sortOrder === 'asc' ? 'desc' : 'asc');
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{selected.size} selected</span>
          <button onClick={handleBulkDelete} className="px-3 py-1 text-sm bg-red-600 text-white rounded-md hover:bg-red-700">
            Delete selected
          </button>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-neutral-200">
        <table className="min-w-full divide-y divide-neutral-200">
          <thead className="bg-neutral-50">
            <tr>
              <th className="w-10 px-4 py-3">
                <input type="checkbox" onChange={toggleAll} checked={selected.size === items.length && items.length > 0} className="h-4 w-4" />
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500 cursor-pointer" onClick={() => handleSort('id')}>
                ID {sortBy === 'id' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
              </th>
${displayFields.map((f) => `              <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500 cursor-pointer" onClick={() => handleSort('${f.name}')}>
                ${f.name} {sortBy === '${f.name}' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
              </th>`).join('\n')}
${belongsToFields.map((f) => `              <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">${f.name}</th>`).join('\n')}
              <th className="px-4 py-3 text-right text-sm font-medium text-neutral-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {items.map((item: any) => (
              <tr key={item.id} className="hover:bg-neutral-50">
                <td className="px-4 py-3">
                  <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleOne(item.id)} className="h-4 w-4" />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm">{item.id}</td>
${tableCellFields.split('\n').map((l) => `                ${l}`).join('\n')}
${belongsToCells.split('\n').map((l) => `                ${l}`).join('\n')}
                <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                  <Link to={\`/${plural(mv)}/edit/\${item.id}\`} className="text-blue-600 hover:underline">
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Page {pagination.page} of {pagination.totalPages} ({pagination.total} items)
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={pagination.page <= 1}
            className="px-3 py-1 border rounded-md disabled:opacity-50 hover:bg-neutral-100"
          >
            Previous
          </button>
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={\`px-3 py-1 border rounded-md \${
                p === pagination.page ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-100'
              }\`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={pagination.page >= pagination.totalPages}
            className="px-3 py-1 border rounded-md disabled:opacity-50 hover:bg-neutral-100"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
`;
  },

  apiModule(model: ModelDefinition) {
    const mv = camelCase(model.name);
    const Mn = model.name;
    return `import { apiClient } from './client';

export const ${mv}Api = {
  getAll: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== '')
        .map(([k, v]) => [k, String(v)])
    ).toString() : '';
    return apiClient.get<any>(\`/${camelCase(plural(mv))}/public\${qs}\`);
  },
  getById: (id: string) => apiClient.get<any>(\`/${camelCase(plural(mv))}/public/\${id}\`),
  create: (data: any) => apiClient.post<any>('/${camelCase(plural(mv))}/private', data),
  update: (id: string, data: any) => apiClient.put<any>(\`/${camelCase(plural(mv))}/private/\${id}\`, data),
  delete: (id: string) => apiClient.del(\`/${camelCase(plural(mv))}/private/\${id}\`),
  bulkDelete: (ids: number[]) => apiClient.post<any>('/${camelCase(plural(mv))}/private/bulk-delete', { ids }),
};
`;
  },

  schema(model: ModelDefinition, allModels?: ModelDefinition[]) {
    const mv = camelCase(model.name);
    const fields = editableFields(model.fields).filter((f) => !f.relation);
    const belongsToFks = model.fields
      .filter((f) => f.relation?.type === 'belongsTo')
      .map((f) => {
        const targetIdField = allModels
          ? (() => {
              const target = allModels.find((m) => m.name === f.relation!.model);
              return target?.fields.find((x: any) => x.isId);
            })()
          : undefined;
        const tsType = targetIdField?.type === 'String' ? 'z.string()' : 'z.coerce.number().int()';
        return `  ${f.name}Id: ${tsType},`;
      });
    return `import { z } from 'zod';

export const ${mv}Schema = z.object({
${fields.map((f) => `  ${f.name}: ${zodType(f)},`).join('\n')}${belongsToFks.length ? '\n' + belongsToFks.join('\n') : ''}
});
`;
  },

  hookList(model: ModelDefinition) {
    const mv = camelCase(model.name);
    const Mn = model.name;
    return `import { useQuery } from '@tanstack/react-query';
import { ${mv}Api } from '@/utils/api/${mv}';

export function use${Mn}s(params?: Record<string, any>) {
  return useQuery({
    queryKey: ['${mv}s', params],
    queryFn: () => ${mv}Api.getAll(params),
  });
}
`;
  },

  hookSingle(model: ModelDefinition) {
    const mv = camelCase(model.name);
    const Mn = model.name;
    return `import { useQuery } from '@tanstack/react-query';
import { ${mv}Api } from '@/utils/api/${mv}';

export function use${Mn}(id: string) {
  return useQuery({
    queryKey: ['${mv}', id],
    queryFn: () => ${mv}Api.getById(id),
  });
}
`;
  },

  hookCreate(model: ModelDefinition) {
    const mv = camelCase(model.name);
    const Mn = model.name;
    return `import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ${mv}Api } from '@/utils/api/${mv}';

export function useCreate${Mn}() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => ${mv}Api.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['${mv}s'] }),
  });
}
`;
  },

  hookUpdate(model: ModelDefinition) {
    const mv = camelCase(model.name);
    const Mn = model.name;
    return `import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ${mv}Api } from '@/utils/api/${mv}';

export function useUpdate${Mn}() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => ${mv}Api.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['${mv}s'] }),
  });
}
`;
  },

  hookDelete(model: ModelDefinition) {
    const mv = camelCase(model.name);
    const Mn = model.name;
    return `import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ${mv}Api } from '@/utils/api/${mv}';

export function useDelete${Mn}() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ${mv}Api.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['${mv}s'] }),
  });
}
`;
  },

  hookBulkDelete(model: ModelDefinition) {
    const mv = camelCase(model.name);
    const Mn = model.name;
    return `import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ${mv}Api } from '@/utils/api/${mv}';

export function useBulkDelete${Mn}() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) => ${mv}Api.bulkDelete(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['${mv}s'] }),
  });
}
`;
  },
};
