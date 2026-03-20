import { redirect } from 'next/navigation'

// La home redirige vers le login — le dashboard sera implémenté à l'étape 4
export default function HomePage() {
  redirect('/login')
}
