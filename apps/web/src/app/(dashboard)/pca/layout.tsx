import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Plan de Continuité d\'Activité',
}

export default function PcaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
