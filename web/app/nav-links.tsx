'use client';
import { usePathname } from 'next/navigation';

export const nav: [string, string][] = [['Home', '/'], ['Product', '/features/'], ['Install', '/get-started/'], ['Docs', '/docs/'], ['Compare', '/compare/'], ['About', '/about/'], ['Contact', '/contact/']];

/** Product navigation; the current section is exposed with aria-current. */
export default function NavLinks() {
  const path = usePathname() || '/';
  return <>{nav.map(([name, href]) => {
    const current = href === '/' ? path === '/' : path.startsWith(href.replace(/\/$/, ''));
    return <a key={href} href={href} aria-current={current ? 'page' : undefined}>{name}</a>;
  })}</>;
}
