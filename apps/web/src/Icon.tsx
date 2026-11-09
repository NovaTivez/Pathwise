const paths: Record<string, string> = {
  home: 'm3 10 9-7 9 7v11h-6v-7H9v7H3Z',
  plan: 'M4 7h16M4 17h16M8 3v8m8 2v8',
  roadmap: 'M6 3v12a3 3 0 0 0 6 0V9a3 3 0 0 1 6 0v12M3 3h6m6 18h6',
  book: 'M12 5C8 2 4 3 2 4v15c4-2 7-1 10 1 3-2 6-3 10-1V4c-2-1-6-2-10 1Zm0 0v15',
  purchases: 'M4 7h16v14H4ZM8 7V5a4 4 0 0 1 8 0v2',
  wallet: 'M3 5h17v15H3Zm0 0V3h14m-1 8h5v5h-5Z',
  shield: 'm12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6Zm-4 10 3 3 5-6',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  check: 'm5 12 4 4L19 6',
  clock: 'M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  cloud: 'M6 18a5 5 0 0 1-1-10 7 7 0 0 1 13 0 5 5 0 0 1 0 10Z',
  code: 'm8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18',
  data: 'M4 20V4m0 16h17M8 16v-5m5 5V7m5 9V3',
  network: 'M8 3h8v5H8Zm4 5v6M4 14h16M4 14v3m16-3v3M1 17h6v5H1Zm16 0h6v5h-6Z',
  help: 'M9 8a3 3 0 0 1 6 0c0 2-3 2-3 5m0 4v.1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  cap: 'm1 8 11-6 11 6-11 6Zm5 3v6c4 4 8 4 12 0v-6m5-3v9',
}
export function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <svg className={`ui-icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.book} /></svg>
}
