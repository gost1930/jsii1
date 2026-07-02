import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ModelDefinition } from './types';
import { zodType, findDisplayName, isFileField } from './types';
import { EXPORT_DIR, overwriteFile } from './writer';
import { camelCase, editableFields, plural, searchableFields } from '../utils/fnHelpers';
import { clientDevLibraries, clientLibraries } from '@/utils/frontEndLibs';

export const FrontendGenerator = {
  bootstrap() {
    overwriteFile(path.join(EXPORT_DIR, 'client', 'package.json'), FrontendGenerator.packageJson());
    overwriteFile(path.join(EXPORT_DIR, 'client', 'index.html'), FrontendGenerator.indexHtml());
    overwriteFile(path.join(EXPORT_DIR, 'client', 'vite.config.ts'), FrontendGenerator.viteConfig());
    overwriteFile(path.join(EXPORT_DIR, 'client', 'tsconfig.json'), FrontendGenerator.tsconfig());
    overwriteFile(path.join(EXPORT_DIR, 'client', 'tsconfig.app.json'), FrontendGenerator.tsconfigApp());
    overwriteFile(path.join(EXPORT_DIR, 'client', 'tsconfig.node.json'), FrontendGenerator.tsconfigNode());
    overwriteFile(path.join(EXPORT_DIR, 'client', '.env'), 'VITE_API_URL=http://localhost:3005/api');
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
    overwriteFile(path.join(EXPORT_DIR, 'client', 'src', 'components', 'ui', 'card.tsx'), FrontendGenerator.uiCard());
    overwriteFile(path.join(EXPORT_DIR, 'client', 'src', 'components', 'ui', 'badge.tsx'), FrontendGenerator.uiBadge());
    overwriteFile(path.join(EXPORT_DIR, 'client', 'src', 'components', 'ui', 'skeleton.tsx'), FrontendGenerator.uiSkeleton());
    overwriteFile(path.join(EXPORT_DIR, 'client', 'src', 'components', 'ui', 'table.tsx'), FrontendGenerator.uiTable());
    overwriteFile(path.join(EXPORT_DIR, 'client', 'src', 'components', 'ui', 'dialog.tsx'), FrontendGenerator.uiDialog());
    overwriteFile(path.join(EXPORT_DIR, 'client', 'src', 'components', 'layout.tsx'), FrontendGenerator.layout());
    overwriteFile(path.join(EXPORT_DIR, 'client', 'src', 'vite-env.d.ts'), FrontendGenerator.viteEnv());

    const cwd = path.join(EXPORT_DIR, 'client');
    try {
      const { execSync } = require('node:child_process');
      if (clientLibraries.length) execSync(`npm install ${clientLibraries.join(' ')}`, { cwd, stdio: 'inherit', timeout: 120000 });
      if (clientDevLibraries.length) execSync(`npm install --save-dev ${clientDevLibraries.join(' ')}`, { cwd, stdio: 'inherit', timeout: 120000 });
      console.log('Client dependencies installed successfully.');
    } catch {
      console.warn('Client dependencies installation failed — run npm install manually.');
    }
  },

  generateAll(models: ModelDefinition[]) {
    FrontendGenerator.bootstrap();
    FrontendGenerator.cleanupStaleFiles(models);
    for (const model of models) {
      FrontendGenerator.generateModelFiles(model, models);
    }
    overwriteFile(path.join(EXPORT_DIR, 'client', 'src', 'App.tsx'), FrontendGenerator.app(models));
  },

  cleanupStaleFiles(models: ModelDefinition[]) {
    const fe = path.join(EXPORT_DIR, 'client');
    const currentNames = new Set(models.map((m) => m.name));
    const currentPlural = new Set(models.map((m) => plural(camelCase(m.name))));

    const pagesDir = path.join(fe, 'src', 'pages');
    if (fs.existsSync(pagesDir)) {
      for (const dir of fs.readdirSync(pagesDir)) {
        if (!currentPlural.has(dir)) {
          try { fs.rmSync(path.join(pagesDir, dir), { recursive: true, force: true }); } catch {}
        }
      }
    }

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

    const apiDir = path.join(fe, 'src', 'utils', 'api');
    if (fs.existsSync(apiDir)) {
      for (const file of fs.readdirSync(apiDir)) {
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
      dependencies: {},
      devDependencies: {},
    }, null, 2);
  },

  indexHtml() {
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
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
  server: {
    allowedHosts: true,
  },
});
`;
  },

  tsconfig() {
    return JSON.stringify({
      files: [], references: [
        { path: './tsconfig.app.json' },
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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import App from './App.tsx';
import './index.css';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--card)',
            color: 'var(--foreground)',
            border: '1px solid var(--border)',
          },
        }}
      />
    </QueryClientProvider>
  </StrictMode>,
);
`;
  },

  app(models: ModelDefinition[] = []) {
    const pageRoutes = models.map((m) => {
      const mv = camelCase(m.name);
      const pl = plural(mv);
      return `      <Route path="/${pl}" element={<${m.name}IndexPage />} />
      <Route path="/${pl}/create" element={<Create${m.name}Page />} />
      <Route path="/${pl}/edit/:id" element={<Edit${m.name}Page />} />`;
    }).join('\n');

    const sidebarLinks = models.map((m) => {
      const mv = camelCase(m.name);
      const Mn = m.name;
      return `      { path: '/${plural(mv)}', label: '${plural(Mn)}', icon: '${mv.slice(0, 3)}' },`;
    }).join('\n');

    const pageImports = models.map((m) => {
      const mv = camelCase(m.name);
      return `import ${m.name}IndexPage from '@/pages/${plural(mv)}';
import Create${m.name}Page from '@/pages/${plural(mv)}/create';
import Edit${m.name}Page from '@/pages/${plural(mv)}/edit/${mv}';`;
    }).join('\n');

    return `import { BrowserRouter } from 'react-router-dom';
import { Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/layout';
${pageImports ? `\n${pageImports}\n` : '\n'}
const routes = [
${sidebarLinks}
];

function App() {
  return (
    <BrowserRouter>
      <Layout links={routes}>
        <Routes>
          <Route path="/" element={<div className="flex items-center justify-center h-full text-muted-foreground/60"><p>Select a page from the sidebar</p></div>} />
${pageRoutes}
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
`;
  },

  layout() {
    return `import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface NavLink {
  path: string;
  label: string;
  icon: string;
}

interface LayoutProps {
  children: ReactNode;
  links: NavLink[];
}

export function Layout({ children, links }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();

  return (
    <div className="min-h-screen flex">
      <aside className={\`border-r border-border bg-card flex flex-col transition-all duration-300 \${
        sidebarOpen ? 'w-56' : 'w-14'
      }\`}>
        <div className="flex items-center gap-2 px-3 h-14 border-b border-border">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg hover:bg-accent/60 text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sidebarOpen ? 'M4 6h16M4 12h16M4 18h16' : 'M4 6h16M4 12h16M4 18h16'} />
            </svg>
          </button>
          {sidebarOpen && <span className="font-semibold text-sm">Agency</span>}
        </div>
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {links.map((link) => {
            const active = location.pathname.startsWith(link.path);
            return (
              <Link
                key={link.path}
                to={link.path}
                className={\`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all \${
                  active
                    ? 'bg-primary/15 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                }\`}
              >
                <span className="shrink-0 w-5 h-5 flex items-center justify-center text-xs font-bold uppercase rounded bg-muted/50">
                  {link.icon}
                </span>
                {sidebarOpen && <span>{link.label}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
`;
  },

  indexCss() {
    return `@import 'tailwindcss';

@custom-variant dark (&:where(.dark, .dark *));

:root {
  --background: oklch(0.13 0.01 260);
  --foreground: oklch(0.92 0.005 260);
  --card: oklch(0.16 0.01 260);
  --card-foreground: oklch(0.92 0.005 260);
  --popover: oklch(0.16 0.01 260);
  --popover-foreground: oklch(0.92 0.005 260);
  --primary: oklch(0.65 0.2 260);
  --primary-foreground: oklch(0.98 0 0);
  --secondary: oklch(0.22 0.015 260);
  --secondary-foreground: oklch(0.85 0.01 260);
  --muted: oklch(0.22 0.015 260);
  --muted-foreground: oklch(0.6 0.01 260);
  --accent: oklch(0.25 0.02 260);
  --accent-foreground: oklch(0.92 0.005 260);
  --destructive: oklch(0.6 0.24 25);
  --destructive-foreground: oklch(0.98 0 0);
  --border: oklch(0.28 0.015 260);
  --input: oklch(0.28 0.015 260);
  --ring: oklch(0.65 0.2 260);
  --radius: 0.625rem;
  --sidebar-background: oklch(0.16 0.01 260);
  --sidebar-foreground: oklch(0.85 0.01 260);
  --sidebar-primary: oklch(0.65 0.2 260);
  --sidebar-primary-foreground: oklch(0.98 0 0);
  --sidebar-accent: oklch(0.25 0.02 260);
  --sidebar-accent-foreground: oklch(0.92 0.005 260);
  --sidebar-border: oklch(0.28 0.015 260);
  --sidebar-ring: oklch(0.65 0.2 260);
}

* { border-color: var(--border); }

body {
  background: var(--background);
  color: var(--foreground);
  font-family: 'Manrope', system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-sidebar-background: var(--sidebar-background);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}
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
    return `import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3005/api',
  headers: { 'Content-Type': 'application/json' },
});

export default api;
`;
  },

  uiButton() {
    return `import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 text-sm font-medium rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-40 disabled:pointer-events-none select-none',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:opacity-90 shadow-sm shadow-primary/20',
        destructive: 'bg-destructive text-destructive-foreground hover:opacity-90 shadow-sm shadow-destructive/20',
        ghost: 'hover:bg-accent/60 text-muted-foreground hover:text-foreground',
        outline: 'border border-border hover:bg-accent/60 hover:text-foreground text-muted-foreground',
      },
      size: {
        sm: 'px-3 py-1.5 text-xs',
        md: 'px-4 py-2',
        icon: 'p-1.5',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) => (
  <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
));
Button.displayName = 'Button';

export { Button, buttonVariants };
`;
  },

  uiInput() {
    return `import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'w-full px-2.5 py-1.5 border border-input rounded-lg bg-transparent text-sm placeholder:text-muted-foreground/40 transition-colors',
      'focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent',
      'disabled:opacity-40 disabled:pointer-events-none',
      className,
    )}
    {...props}
  />
));
Input.displayName = 'Input';

export { Input };
`;
  },

  uiLabel() {
    return `import { type LabelHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('block text-xs text-muted-foreground mb-1', className)} {...props} />;
}
`;
  },

  uiSelect() {
    return `import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'px-2.5 py-1.5 border border-input rounded-lg bg-transparent text-sm transition-colors',
      'focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent',
      'disabled:opacity-40 disabled:pointer-events-none',
      className,
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = 'Select';

export { Select };
`;
  },

  uiCheckbox() {
    return `import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input
    type="checkbox"
    ref={ref}
    className={cn(
      'h-4 w-4 rounded border-input bg-transparent accent-primary',
      'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background',
      'disabled:opacity-40',
      className,
    )}
    {...props}
  />
));
Checkbox.displayName = 'Checkbox';

export { Checkbox };
`;
  },

  uiCard() {
    return `import { type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-xl border border-border bg-card text-card-foreground shadow-sm', className)} {...props} />;
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('font-semibold leading-none tracking-tight', className)} {...props} />;
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-6 pt-0', className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center p-6 pt-0', className)} {...props} />;
}
`;
  },

  uiBadge() {
    return `import { type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center px-2 py-0.5 text-xs rounded-full font-medium border',
  {
    variants: {
      variant: {
        default: 'bg-muted text-muted-foreground border-border',
        primary: 'bg-primary/15 text-primary border-primary/30',
        destructive: 'bg-destructive/15 text-destructive border-destructive/30',
        outline: 'bg-transparent border-border text-muted-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
`;
  },

  uiSkeleton() {
    return `import { cn } from '@/lib/utils';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />;
}
`;
  },

  uiTable() {
    return `import { type HTMLAttributes, type TdHTMLAttributes, type ThHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="relative w-full overflow-auto">
      <table className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  );
}

export function TableHeader({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('[&_tr]:border-b', className)} {...props} />;
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />;
}

export function TableFooter({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tfoot className={cn('border-t bg-muted/50 font-medium [&>tr]:last:border-b-0', className)} {...props} />;
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={cn('border-b border-border transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted', className)} {...props} />
  );
}

export function TableHead({ className, ...props }: ThHTMLAttributes<HTMLTableHeaderCellElement>) {
  return (
    <th className={cn('h-10 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0', className)} {...props} />
  );
}

export function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableDataCellElement>) {
  return (
    <td className={cn('p-4 align-middle [&:has([role=checkbox])]:pr-0', className)} {...props} />
  );
}

export function TableCaption({ className, ...props }: HTMLAttributes<HTMLTableCaptionElement>) {
  return <caption className={cn('mt-4 text-sm text-muted-foreground', className)} {...props} />;
}
`;
  },

  uiDialog() {
    return `import { type ReactNode, type ButtonHTMLAttributes, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
}

export function Dialog({ open, onClose, title, description, children, footer }: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div ref={ref} className="relative z-50 w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex flex-col space-y-1.5 mb-4">
          <h3 className="font-semibold leading-none tracking-tight text-lg">{title}</h3>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {children && <div className="py-2">{children}</div>}
        {footer && <div className="flex items-center justify-end gap-2 pt-4">{footer}</div>}
      </div>
    </div>
  );
}
`;
  },

  viteEnv() {
    return `/// <reference types="vite/client" />
`;
  },

  pageIndex(model: ModelDefinition, allModels: ModelDefinition[]) {
    const Mn = model.name;
    const mv = camelCase(model.name);
    const pl = plural(mv);
    return `import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ${Mn}Table } from './components/table';
import { ${Mn}FilterBar } from './components/filter-bar';

export default function ${Mn}IndexPage() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">${plural(Mn)}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage ${plural(mv)}</p>
        </div>
        <Link to="/${pl}/create">
          <Button size="sm"><Plus className="h-4 w-4" /> Create ${Mn}</Button>
        </Link>
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Create ${Mn}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Add a new ${mv}</p>
      </div>
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
import { Skeleton } from '@/components/ui/skeleton';

export default function Edit${Mn}Page() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = use${Mn}(id!);

  if (isLoading) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Edit ${Mn}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Update ${mv} details</p>
      </div>
      <${Mn}Form initialData={data} />
    </div>
  );
}
`;
  },

  filterBar(model: ModelDefinition) {
    const Mn = model.name;
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
import { Search } from 'lucide-react';

interface Props {
  filters: Record<string, string>;
  onFiltersChange: Dispatch<SetStateAction<Record<string, string>>>;
}

export function ${Mn}FilterBar({ filters, onFiltersChange }: Props) {
  return (
    <div className="flex flex-wrap gap-3">
${sFields.map((f) => `      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
        <input
          placeholder="Filter by ${f.name}..."
          value={filters['${f.name}'] ?? ''}
          onChange={(e) => onFiltersChange((prev: any) => ({ ...prev, '${f.name}': e.target.value }))}
          className="pl-8 pr-3 py-1.5 border border-input rounded-lg bg-transparent text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
        />
      </div>`).join('\n')}
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

    const fieldInputs = editFields.map((f) => {
      if (isFileField(f.name)) {
        return `      <div className="space-y-2">
          <Label htmlFor="${f.name}">${f.name}</Label>
          <Input id="${f.name}" type="file" accept="image/*,.pdf,.doc,.docx" {...register('${f.name}')} />
          {errors.${f.name} && <p className="text-xs text-destructive">{errors.${f.name}.message}</p>}
        </div>`;
      }

      if (f.type === 'Boolean') {
        return `      <div className="flex items-center gap-3">
          <input type="checkbox" id="${f.name}" {...register('${f.name}')} className="h-4 w-4 rounded border-input accent-primary" />
          <Label htmlFor="${f.name}" className="mb-0 cursor-pointer">${f.name}</Label>
          {errors.${f.name} && <p className="text-xs text-destructive">{errors.${f.name}.message}</p>}
        </div>`;
      }

      if (f.enumValues?.length) {
        return `      <div className="space-y-2">
          <Label htmlFor="${f.name}">${f.name}</Label>
          <Select id="${f.name}" {...register('${f.name}')}>
            <option value="">Select...</option>
            ${f.enumValues.map((v) => `<option value="${v}">${v}</option>`).join('\n            ')}
          </Select>
          {errors.${f.name} && <p className="text-xs text-destructive">{errors.${f.name}.message}</p>}
        </div>`;
      }

      return `      <div className="space-y-2">
        <Label htmlFor="${f.name}">${f.name}</Label>
        <Input id="${f.name}" {...register('${f.name}')} />
        {errors.${f.name} && <p className="text-xs text-destructive">{errors.${f.name}.message}</p>}
      </div>`;
    }).join('\n');

    const relInputs = belongsToRelations.map((f) => {
      const target = allModels.find((m) => m.name === f.relation!.model);
      const displayName = target ? findDisplayName(target.fields) : 'id';
      const targetMv = target ? camelCase(target.name) : 'unknown';
      return `      <div className="space-y-2">
        <Label htmlFor="${f.name}Id">${f.name}</Label>
        <Select id="${f.name}Id" {...register('${f.name}Id')}>
          <option value="">Select ${f.relation!.model}...</option>
          {${targetMv}s?.data?.data?.map((item: any) => (
            <option key={item.id} value={item.id}>{item.${displayName}}</option>
          ))}
        </Select>
        {errors.${f.name}Id && <p className="text-xs text-destructive">{errors.${f.name}Id.message}</p>}
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { ${mv}Schema } from '@/schemas/${mv}';
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        ${hasFields ? fieldInputs + '\n' + relInputs : '<p className="text-sm text-muted-foreground">No editable fields</p>'}
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit">{isEditing ? 'Update' : 'Create'}</Button>
        <Button type="button" variant="outline" onClick={() => window.history.back()}>Cancel</Button>
      </div>
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

    return `import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Edit, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { use${Mn}s } from '@/hooks/use${plural(Mn)}';
import { useBulkDelete${Mn} } from '@/hooks/useBulkDelete${Mn}';
import { useDelete${Mn} } from '@/hooks/useDelete${Mn}';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog } from '@/components/ui/dialog';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';

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
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { data, isLoading } = use${Mn}s({ page, limit: 10, sortBy, sortOrder, ...filters });
  const bulkDelete = useBulkDelete${Mn}();
  const deleteItem = useDelete${Mn}();

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
    bulkDelete.mutate(Array.from(selected), { onSuccess: () => setSelected(new Set()) });
  };

  const handleSort = (field: string) => {
    if (onSortByChange) onSortByChange(field);
    if (onSortOrderChange) onSortOrderChange(sortBy === field && sortOrder === 'asc' ? 'desc' : 'asc');
  };

  if (isLoading) return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );

  return (
    <div className="space-y-4">
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-destructive/10 border border-destructive/20">
          <span className="text-sm text-muted-foreground">{selected.size} selected</span>
          <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
            <Trash2 className="h-4 w-4" /> Delete selected
          </Button>
        </div>
      )}
      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input type="checkbox" onChange={toggleAll} checked={selected.size === items.length && items.length > 0} className="h-4 w-4 rounded border-input accent-primary" />
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort('id')}>
                ID {sortBy === 'id' ? (sortOrder === 'asc' ? '\\u25B2' : '\\u25BC') : ''}
              </TableHead>
${displayFields.map((f) => `              <TableHead className="cursor-pointer" onClick={() => handleSort('${f.name}')}>
                ${f.name} {sortBy === '${f.name}' ? (sortOrder === 'asc' ? '\\u25B2' : '\\u25BC') : ''}
              </TableHead>`).join('\n')}
${belongsToFields.map(() => `              <TableHead>Related</TableHead>`).join('\n')}
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={${2 + displayFields.length + belongsToFields.length}} className="text-center text-muted-foreground py-8">
                  No ${plural(mv)} found
                </TableCell>
              </TableRow>
            )}
            {items.map((item: any) => (
              <TableRow key={item.id}>
                <TableCell>
                  <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleOne(item.id)} className="h-4 w-4 rounded border-input accent-primary" />
                </TableCell>
                <TableCell className="font-medium">{item.id}</TableCell>
${displayFields.map((f) => {
  if (f.type === 'Boolean') {
    return `                <TableCell><Badge variant={item.${f.name} ? 'primary' : 'outline'}>{item.${f.name} ? 'Yes' : 'No'}</Badge></TableCell>`;
  }
  return `                <TableCell>{item.${f.name}}</TableCell>`;
}).join('\n')}
${belongsToFields.map((f) => {
  const target = allModels.find((m) => m.name === f.relation!.model);
  const displayName = target ? findDisplayName(target.fields) : 'id';
  return `                <TableCell>{item.${f.name}?.${displayName} ?? '-'}</TableCell>`;
}).join('\n')}
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Link to={\`/${plural(mv)}/edit/\${item.id}\`}>
                      <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
                    </Link>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(item.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Page {pagination.page} of {pagination.totalPages} ({pagination.total} items)
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={pagination.page <= 1}>
            <ChevronLeft className="h-4 w-4" /> Previous
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={pagination.page >= pagination.totalPages}>
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <Dialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Confirm Delete"
        description="Are you sure you want to delete this item?"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { if (deleteId) deleteItem.mutate(deleteId); setDeleteId(null); }}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </>
        }
      />
    </div>
  );
}
`;
  },

  apiModule(model: ModelDefinition) {
    const mv = camelCase(model.name);
    const Mn = model.name;
    return `import api from '@/lib/api';

export const ${mv}Api = {
  getAll: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== '')
        .map(([k, v]) => [k, String(v)])
    ).toString() : '';
    return api.get<any>(\`/${camelCase(plural(mv))}/public\${qs}\`);
  },
  getById: (id: string) => api.get<any>(\`/${camelCase(plural(mv))}/public/\${id}\`),
  create: (data: any) => api.post<any>('/${camelCase(plural(mv))}/private', data),
  update: (id: string, data: any) => api.put<any>(\`/${camelCase(plural(mv))}/private/\${id}\`, data),
  delete: (id: string) => api.delete(\`/${camelCase(plural(mv))}/private/\${id}\`),
  bulkDelete: (ids: number[]) => api.post<any>('/${camelCase(plural(mv))}/private/bulk-delete', { ids }),
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
import { toast } from 'sonner';

export function useCreate${Mn}() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => ${mv}Api.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['${mv}s'] });
      toast.success('${Mn} created successfully');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || err.message),
  });
}
`;
  },

  hookUpdate(model: ModelDefinition) {
    const mv = camelCase(model.name);
    const Mn = model.name;
    return `import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ${mv}Api } from '@/utils/api/${mv}';
import { toast } from 'sonner';

export function useUpdate${Mn}() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => ${mv}Api.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['${mv}s'] });
      toast.success('${Mn} updated successfully');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || err.message),
  });
}
`;
  },

  hookDelete(model: ModelDefinition) {
    const mv = camelCase(model.name);
    const Mn = model.name;
    return `import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ${mv}Api } from '@/utils/api/${mv}';
import { toast } from 'sonner';

export function useDelete${Mn}() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ${mv}Api.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['${mv}s'] });
      toast.success('${Mn} deleted successfully');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || err.message),
  });
}
`;
  },

  hookBulkDelete(model: ModelDefinition) {
    const mv = camelCase(model.name);
    const Mn = model.name;
    return `import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ${mv}Api } from '@/utils/api/${mv}';
import { toast } from 'sonner';

export function useBulkDelete${Mn}() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) => ${mv}Api.bulkDelete(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['${mv}s'] });
      toast.success('${plural(Mn)} deleted successfully');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || err.message),
  });
}
`;
  },
};
