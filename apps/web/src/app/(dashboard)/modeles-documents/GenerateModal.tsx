'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { X, Download, Search, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { documentTemplateApi, contactApi, type DocumentTemplate, type Contact } from '@/lib/api'

interface GenerateModalProps {
  template: DocumentTemplate
  onClose: () => void
}

export default function GenerateModal({ template, onClose }: GenerateModalProps) {
  const { token } = useAuthStore()
  const [contactSearch, setContactSearch] = useState('')
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const needsContact = template.targetEntity === 'CONTACT'

  const { data: contactsData, isLoading: contactsLoading } = useQuery({
    queryKey: ['contacts-for-generate', token, contactSearch],
    queryFn: () => contactApi.list(token!, { search: contactSearch, limit: 20 }),
    enabled: !!token && needsContact,
  })

  const contacts = contactsData?.data.contacts ?? []

  const generateMutation = useMutation({
    mutationFn: () =>
      documentTemplateApi.generate(
        template.id,
        needsContact && selectedContact ? { contactId: selectedContact.id } : {},
        token!
      ),
    onSuccess: (res) => {
      // Ajouter le token en query param pour que <a href download> fonctionne sans header
      const url = new URL(res.data.downloadUrl, window.location.origin)
      url.searchParams.set('token', token!)
      setDownloadUrl(url.toString())
    },
    onError: (err: Error) => {
      setError(err.message)
    },
  })

  const canGenerate = !needsContact || !!selectedContact

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border rounded-xl shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="font-semibold">Générer un document</h2>
            <p className="text-sm text-muted-foreground">{template.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-accent transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Contenu */}
        <div className="p-5 space-y-4">
          {!downloadUrl ? (
            <>
              {needsContact && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Sélectionner un contact *</label>

                  {/* Recherche */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={contactSearch}
                      onChange={(e) => {
                        setContactSearch(e.target.value)
                        setSelectedContact(null)
                      }}
                      placeholder="Rechercher un contact..."
                      className="w-full pl-9 pr-3 py-2 border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>

                  {/* Contact sélectionné */}
                  {selectedContact && (
                    <div className="flex items-center justify-between px-3 py-2 bg-primary/5 border border-primary/20 rounded-md">
                      <p className="text-sm font-medium">
                        {selectedContact.firstName ?? ''} {selectedContact.lastName}
                      </p>
                      <button
                        onClick={() => setSelectedContact(null)}
                        className="p-0.5 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Liste de contacts */}
                  {!selectedContact && (
                    <div className="border rounded-md max-h-48 overflow-y-auto">
                      {contactsLoading ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      ) : contacts.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Aucun contact trouvé</p>
                      ) : (
                        contacts.map((contact) => (
                          <button
                            key={contact.id}
                            type="button"
                            onClick={() => setSelectedContact(contact)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-accent/50 transition-colors border-b last:border-0"
                          >
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium shrink-0">
                              {(contact.firstName?.[0] ?? contact.lastName[0]).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium">
                                {contact.firstName ?? ''} {contact.lastName}
                              </p>
                              {contact.email && (
                                <p className="text-xs text-muted-foreground">{contact.email}</p>
                              )}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {!needsContact && (
                <p className="text-sm text-muted-foreground">
                  Ce modèle utilisera les données du cabinet pour remplir les variables.
                </p>
              )}

              {error && (
                <div className="px-3 py-2 rounded-md bg-destructive/10 text-destructive text-sm">
                  {error}
                </div>
              )}
            </>
          ) : (
            <div className="text-center space-y-3 py-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20 mx-auto">
                <Download className="h-7 w-7 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="font-medium">Document généré avec succès !</p>
                <p className="text-sm text-muted-foreground mt-0.5">Cliquez pour télécharger votre document Word.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border rounded-md hover:bg-accent transition-colors"
          >
            {downloadUrl ? 'Fermer' : 'Annuler'}
          </button>
          {!downloadUrl ? (
            <button
              onClick={() => generateMutation.mutate()}
              disabled={!canGenerate || generateMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {generateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Générer
            </button>
          ) : (
            <a
              href={downloadUrl}
              download
              className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              <Download className="h-4 w-4" />
              Télécharger
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
