import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata = {
  title: "Conditions générales d'utilisation — CGP Platform",
}

export default function TermsPage() {
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

        <h1 className="text-2xl font-bold mb-2">Conditions générales d&apos;utilisation</h1>
        <p className="text-sm text-muted-foreground mb-10">Dernière mise à jour : mars 2026</p>

        <div className="space-y-8 text-sm">

          <section>
            <h2 className="text-base font-semibold mb-3">1. Objet</h2>
            <p className="text-muted-foreground leading-relaxed">
              Les présentes conditions générales d&apos;utilisation (CGU) régissent l&apos;accès et l&apos;utilisation
              de CGP Platform, une solution SaaS de gestion destinée aux cabinets de conseil en gestion de patrimoine
              (CGP). En accédant à la plateforme, vous acceptez sans réserve les présentes CGU.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">2. Accès au service</h2>
            <p className="text-muted-foreground leading-relaxed">
              L&apos;accès à la plateforme est réservé aux professionnels du secteur financier. Chaque cabinet
              souscrit un compte et peut inviter ses collaborateurs. L&apos;utilisateur est responsable de la
              confidentialité de ses identifiants. Tout accès non autorisé doit être signalé immédiatement.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">3. Utilisation autorisée</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">L&apos;utilisateur s&apos;engage à :</p>
            <ul className="space-y-1.5 text-muted-foreground list-disc list-inside">
              <li>Utiliser le service conformément à sa destination professionnelle</li>
              <li>Ne pas tenter de contourner les mécanismes de sécurité</li>
              <li>Ne pas téléverser de contenus illicites, malveillants ou contrefaits</li>
              <li>Respecter la réglementation applicable (RGPD, AMF, loi LCB-FT)</li>
              <li>Ne pas partager son accès avec des tiers non autorisés</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">4. Données et confidentialité</h2>
            <p className="text-muted-foreground leading-relaxed">
              Le cabinet reste propriétaire de ses données. L&apos;Opérateur s&apos;engage à ne pas exploiter
              les données clients à des fins commerciales. Pour plus de détails, consultez notre{' '}
              <Link href="/legal/privacy" className="text-primary hover:underline">
                politique de confidentialité
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">5. Disponibilité du service</h2>
            <p className="text-muted-foreground leading-relaxed">
              L&apos;Opérateur s&apos;efforce d&apos;assurer la disponibilité du service 24h/24, 7j/7, sans
              engagement de niveau de service (SLA). Des interruptions pour maintenance peuvent survenir, avec
              préavis autant que possible. L&apos;Opérateur ne saurait être tenu responsable des interruptions
              liées à des événements hors de son contrôle.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">6. Responsabilité</h2>
            <p className="text-muted-foreground leading-relaxed">
              L&apos;Opérateur ne peut être tenu responsable des dommages indirects liés à l&apos;utilisation
              du service. La responsabilité totale de l&apos;Opérateur est limitée au montant des sommes versées
              au cours des 12 derniers mois. L&apos;utilisateur est seul responsable de l&apos;exactitude des
              informations saisies et de la conformité réglementaire de son activité.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">7. Propriété intellectuelle</h2>
            <p className="text-muted-foreground leading-relaxed">
              La plateforme et ses composants (code, design, marques) sont la propriété exclusive de l&apos;Opérateur.
              Toute reproduction ou réutilisation sans autorisation écrite est interdite. Les données saisies
              par le cabinet restent sa propriété exclusive.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">8. Résiliation</h2>
            <p className="text-muted-foreground leading-relaxed">
              Chaque partie peut mettre fin au service avec un préavis de 30 jours. En cas de violation grave
              des présentes CGU, l&apos;Opérateur se réserve le droit de suspendre immédiatement l&apos;accès.
              À la résiliation, le cabinet dispose de 30 jours pour exporter ses données avant suppression définitive.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">9. Modification des CGU</h2>
            <p className="text-muted-foreground leading-relaxed">
              L&apos;Opérateur se réserve le droit de modifier les présentes CGU. Les utilisateurs seront informés
              par e-mail au moins 30 jours avant l&apos;entrée en vigueur des nouvelles conditions.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">10. Droit applicable</h2>
            <p className="text-muted-foreground leading-relaxed">
              Les présentes CGU sont soumises au droit français. Tout litige sera porté devant les tribunaux
              compétents de Paris, sauf disposition légale contraire.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">11. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              Pour toute question relative aux présentes CGU :{' '}
              <a href="mailto:contact@cgp-platform.fr" className="text-primary hover:underline">
                contact@cgp-platform.fr
              </a>
            </p>
          </section>

        </div>

        <div className="mt-12 pt-6 border-t border-border flex gap-4 text-sm text-muted-foreground">
          <Link href="/legal/privacy" className="hover:text-foreground hover:underline">
            Politique de confidentialité
          </Link>
        </div>
      </div>
    </div>
  )
}
