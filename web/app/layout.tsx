import type { Metadata } from 'next';
import './globals.css';
import NavLinks from './nav-links';

export const metadata: Metadata = {
  metadataBase: new URL('https://schoolkick.nodedr.com'),
  title: { default: 'Free School Attendance Software | SchoolKick', template: '%s | SchoolKick' },
  description: 'Self-hosted, open-source school attendance software. Teachers take the register, families see a simple browser view, and every correction keeps its history.',
  applicationName: 'SchoolKick', openGraph: { type: 'website', siteName: 'SchoolKick', locale: 'en', images: [{ url: '/s/og.png', width: 1200, height: 630, alt: 'SchoolKick attendance dashboard with a kept correction history' }] },
  twitter: { card: 'summary_large_image' }, alternates: { canonical: '/', types: { 'text/plain': '/llms.txt', 'text/markdown': '/llms-full.txt' } }, robots: { index: true, follow: true },
};

const productStructuredData = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'SchoolKick',
  description: 'Self-hosted, open-source school attendance software with correction history, a family browser view, validated imports, fee records and exam registration.',
  url: 'https://schoolkick.nodedr.com/',
  applicationCategory: 'EducationalApplication',
  operatingSystem: 'Web, Linux, Docker',
  softwareVersion: '0.1.0', // latest published release; the source tree is ahead of it (see /get-started/)
  license: 'https://www.gnu.org/licenses/agpl-3.0.html',
  codeRepository: 'https://github.com/Raktim94/schoolkick',
  isAccessibleForFree: true,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
};

const nav: [string, string][] = [['Home','/'],['Product','/features/'],['Install','/get-started/'],['Docs','/docs/'],['Compare','/compare/'],['About','/about/'],['Contact','/contact/']];
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productStructuredData) }} /><a className="skip" href="#main">Skip to content</a><header className="top"><div className="wrap"><a className="brand" href="/"><img src="/icon-192.png" width="28" height="28" alt=""/>SchoolKick</a><nav className="desk" aria-label="Main navigation"><NavLinks /></nav><a className="btn sm" href="/get-started/">Get SchoolKick</a><details className="mob"><summary>Menu</summary><nav aria-label="Mobile navigation"><NavLinks /><a href="/screenshots/">Screenshots</a><a href="/privacy/">Privacy</a><a href="/accessibility/">Accessibility</a><a href="/legal/">Legal</a></nav></details></div></header>{children}<footer><div className="wrap foot"><div><a className="brand" href="/">SchoolKick</a><p>Open-source school attendance · AGPL-3.0-only · Early release</p></div><nav aria-label="Product"><h2>Product</h2>{nav.map(([name,href])=><a key={href} href={href}>{name}</a>)}<a href="/screenshots/">Screenshots</a></nav><nav aria-label="Trust and legal"><h2>Trust &amp; legal</h2><a href="/ai/">AI and machine-readable access</a><a href="/llms.txt">AI-readable product guide</a><a href="/api/v1/openapi.json">OpenAPI route map</a><a href="/contact/">Contact</a><a href="/accessibility/">Accessibility</a><a href="/privacy/">Privacy</a><a href="/legal/">Legal</a><a href="/license/">License</a><a href="/contribute/">Contribute</a><a href="/contributors/">Contributors</a><a href="/security/">Security</a><a href="https://github.com/Raktim94/schoolkick">Source code</a><a href="https://github.com/Raktim94/schoolkick/issues">Report an issue</a><a href="https://www.nodedr.com/software">More from NodeDR ↗</a></nav></div></footer></body></html>;
}
