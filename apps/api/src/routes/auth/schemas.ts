import { z } from 'zod'

export const signupBody = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
})

export const loginBody = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
})

export type SignupBody = z.infer<typeof signupBody>
export type LoginBody = z.infer<typeof loginBody>
