import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata = {
  title: 'Politique de confidentialité — CGP Platform',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Link>

        <h1 className="text-2xl font-bold mb-2">Politique de confidentialité</h1>
        <p className="text-sm text-muted-foreground mb-10">Dernière mise à jour : mars 2026</p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-8">

          <section>
            <h2 className="text-base font-semibold mb-3">1. Qui collecte vos données ?</h2>
            <p className="text-muted-foreground leading-relaxed">
              CGP Platform est opérée par son éditeur (ci-après « l&apos;Opérateur »). L&apos;Opérateur agit en tant que
              responsable du traitement des données personnelles collectées via cette plateforme.
              Pour toute question, contactez-nous à :{' '}
              <a href="mailto:contact@cgp-platform.fr" className="text-primary hover:underline">
                contact@cgp-platform.fr
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">2. Quelles données collectons-nous ?</h2>
            <ul className="space-y-2 text-muted-foreground">
              {[
                { label: 'Données de compte', desc: 'Adresse e-mail, nom, prénom, rôle au sein du cabinet.' },
                { label: 'Données du cabinet', desc: 'Nom, SIRET, adresse, données de conformité et de gestion.' },
                { label: 'Données clients (CRM)', desc: 'Informations saisies par vos soins concernant vos clients.' },
                { label: 'Documents', desc: 'Fichiers téléversés dans la GED, stockés chiffrés.' },
                { label: 'Données de navigation', desc: 'Cookies de session nécessaires au fonctionnement (voir section 5).' },
              ].map((item) => (
                <li key={item.label} className="flex gap-2">
                  <span className="shrink-0 font-medium text-foreground">{item.label} :</span>
                  <span>{item.desc}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">3. Pourquoi collectons-nous ces données ?</h2>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Finalité</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Base légale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-muted-foreground">
                  {[
                    { purpose: 'Fourniture du service (authentification, GED, CRM)', basis: 'Exécution du contrat' },
                    { purpose: 'Sécurité et prévention des fraudes', basis: 'Intérêt légitime' },
                    { purpose: 'Respect des obligations légales (conformité CGP)', basis: 'Obligation légale' },
                    { purpose: 'Amélioration du service', basis: 'Intérêt légitime' },
                  ].map((row) => (
                    <tr key={row.purpose} className="bg-card">
                      <td className="px-4 py-2.5">{row.purpose}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">{row.basis}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">4. Durées de conservation</h2>
            <ul className="space-y-2 text-muted-foreground">
              {[
                { label: 'Données de compte actif', duration: 'Durée de la relation contractuelle + 3 ans' },
                { label: 'Données clients (CRM)', duration: '5 ans après la fin de la relation client' },
                { label: 'Documents GED', duration: 'Durée choisie par le cabinet + 5 ans archivage légal' },
                { label: 'Logs de connexion', duration: '12 mois' },
                { label: 'Cookies de session', duration: 'Session (voir section 5)' },
              ].map((item) => (
                <li key={item.label} className="flex gap-2">
                  <span className="shrink-0 font-medium text-foreground">{item.label} :</span>
                  <span>{item.duration}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">5. Cookies</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              Nous utilisons uniquement des cookies strictement nécessaires au fonctionnement du service.
              Ces cookies ne nécessitent pas de consentement préalable en vertu de l&apos;article 82 de la loi
              Informatique et Libertés.
            </p>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Cookie</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Finalité</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Durée</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-muted-foreground">
                  {[
                    { name: 'sb-access-token', purpose: 'Authentification Supabase', duration: 'Session' },
                    { name: 'sb-refresh-token', purpose: 'Renouvellement de session', duration: '30 jours' },
                    { name: 'cgp_cookie_consent', purpose: 'Mémorisation de votre choix', duration: '1 an' },
                  ].map((row) => (
                    <tr key={row.name} className="bg-card">
                      <td className="px-3 py-2 font-mono text-[11px]">{row.name}</td>
                      <td className="px-3 py-2">{row.purpose}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{row.duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">6. Vos droits</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              Conformément au RGPD, vous disposez des droits suivants sur vos données personnelles :
            </p>
            <ul className="space-y-1 text-muted-foreground list-disc list-inside">
              <li><strong className="text-foreground">Accès</strong> : obtenir une copie de vos données</li>
              <li><strong className="text-foreground">Rectification</strong> : corriger des données inexactes</li>
              <li><strong className="text-foreground">Effacement</strong> : demander la suppression de vos données</li>
              <li><strong className="text-foreground">Portabilité</strong> : recevoir vos données dans un format structuré</li>
              <li><strong className="text-foreground">Opposition</strong> : vous opposer à certains traitements</li>
              <li><strong className="text-foreground">Limitation</strong> : restreindre le traitement dans certains cas</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-3">
              Pour exercer ces droits, rendez-vous dans{' '}
              <Link href="/parametres" className="text-primary hover:underline">Paramètres → Mes données</Link>{' '}
              ou contactez-nous à{' '}
              <a href="mailto:contact@cgp-platform.fr" className="text-primary hover:underline">
                contact@cgp-platform.fr
              </a>
              . Vous pouvez également introduire une réclamation auprès de la{' '}
              <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                CNIL
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">7. Contact & DPO</h2>
            <p className="text-muted-foreground leading-relaxed">
              Responsable du traitement / DPO :{' '}
              <a href="mailto:contact@cgp-platform.fr" className="text-primary hover:underline">
                contact@cgp-platform.fr
              </a>
            </p>
          </section>

        </div>

        <div className="mt-12 pt-6 border-t border-border flex gap-4 text-sm text-muted-foreground">
          <Link href="/legal/terms" className="hover:text-foreground hover:underline">
            Conditions générales d&apos;utilisation
          </Link>
        </div>
      </div>
    </div>
  )
}
