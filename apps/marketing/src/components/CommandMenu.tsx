'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { Search, Home, Briefcase, FileText, Lock, MessageSquare, Newspaper, Activity } from 'lucide-react';

export function CommandMenu() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const runCommand = React.useCallback((command: () => unknown) => {
    setOpen(false);
    command();
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-start justify-center pt-[15vh]">
      {/* Escucha clics fuera del modal para cerrar */}
      <div className="absolute inset-0 z-0" onClick={() => setOpen(false)} />
      
      <div className="relative z-10 w-full max-w-xl mx-4 overflow-hidden rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl ring-1 ring-slate-800">
        <Command label="Global Command Menu" className="flex flex-col w-full h-full bg-transparent text-slate-100">
          <div className="flex items-center border-b border-slate-800 px-3">
            <Search className="w-5 h-5 text-slate-400 shrink-0" />
            <Command.Input 
              autoFocus 
              placeholder="Escribe un comando o busca algo..." 
              className="w-full flex-1 bg-transparent px-3 py-4 text-slate-100 placeholder:text-slate-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50" 
            />
            <div className="flex items-center gap-1">
              <kbd className="bg-slate-800 px-2 rounded-md text-xs font-mono text-slate-400 py-1 border border-slate-700">ESC</kbd>
            </div>
          </div>

          <Command.List className="max-h-[300px] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
            <Command.Empty className="py-6 text-center text-sm text-slate-400">
              No se encontraron resultados.
            </Command.Empty>

            <Command.Group heading="Navegación Principal" className="text-xs font-medium text-slate-500 px-2 py-1.5 overflow-hidden [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-slate-400">
              <Command.Item 
                onSelect={() => runCommand(() => router.push('/'))}
                className="relative flex cursor-default select-none items-center rounded-md px-2 py-2.5 text-sm outline-none aria-selected:bg-slate-800 aria-selected:text-amber-400 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 transition-colors"
              >
                <Home className="mr-2 h-4 w-4" />
                Home
              </Command.Item>
              <Command.Item 
                onSelect={() => runCommand(() => router.push('/#servicios'))}
                className="relative flex cursor-default select-none items-center rounded-md px-2 py-2.5 text-sm outline-none aria-selected:bg-slate-800 aria-selected:text-amber-400 transition-colors"
              >
                <Briefcase className="mr-2 h-4 w-4" />
                Servicios Cloud
              </Command.Item>
              <Command.Item 
                onSelect={() => runCommand(() => router.push('/#contacto'))}
                className="relative flex cursor-default select-none items-center rounded-md px-2 py-2.5 text-sm outline-none aria-selected:bg-slate-800 aria-selected:text-amber-400 transition-colors"
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                Iniciar Proyecto
              </Command.Item>
            </Command.Group>

            <Command.Group heading="Hub de Ingeniería B2B" className="mt-2 text-xs font-medium text-slate-500 px-2 py-1.5 overflow-hidden [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-slate-400">
              <Command.Item 
                onSelect={() => runCommand(() => router.push('/insights'))}
                className="relative flex cursor-default select-none items-center rounded-md px-2 py-2.5 text-sm outline-none aria-selected:bg-slate-800 aria-selected:text-amber-400 transition-colors"
              >
                <Newspaper className="mr-2 h-4 w-4" />
                Insights (Blog Técnico)
              </Command.Item>
              <Command.Item 
                onSelect={() => runCommand(() => router.push('/seguridad'))}
                className="relative flex cursor-default select-none items-center rounded-md px-2 py-2.5 text-sm outline-none aria-selected:bg-slate-800 aria-selected:text-amber-400 transition-colors"
              >
                <Lock className="mr-2 h-4 w-4 text-emerald-400" />
                Arquitectura & Seguridad
              </Command.Item>
            </Command.Group>

            <Command.Group heading="Cumplimiento Legal" className="mt-2 text-xs font-medium text-slate-500 px-2 py-1.5 overflow-hidden [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-slate-400">
              <Command.Item 
                onSelect={() => runCommand(() => router.push('/privacidad'))}
                className="relative flex cursor-default select-none items-center rounded-md px-2 py-2.5 text-sm outline-none aria-selected:bg-slate-800 aria-selected:text-amber-400 transition-colors"
              >
                <FileText className="mr-2 h-4 w-4 text-slate-400" />
                Política de Privacidad
              </Command.Item>
              <Command.Item 
                onSelect={() => runCommand(() => router.push('/terminos'))}
                className="relative flex cursor-default select-none items-center rounded-md px-2 py-2.5 text-sm outline-none aria-selected:bg-slate-800 aria-selected:text-amber-400 transition-colors"
              >
                <FileText className="mr-2 h-4 w-4 text-slate-400" />
                Términos de Servicio
              </Command.Item>
            </Command.Group>

          </Command.List>
        </Command>
      </div>
    </div>
  );
}
