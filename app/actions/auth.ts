'use server'
import { signIn } from '@/lib/auth'
import { AuthError } from 'next-auth'

export async function loginAction(email: string, password: string): Promise<{ error: string } | undefined> {
  try {
    await signIn('credentials', {
      email,
      password,
      redirectTo: '/dashboard',
    })
  } catch (error) {
    // Re-throw Next.js redirect (this is how successful login works in Server Actions)
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) throw error
    if (error instanceof AuthError) {
      return { error: 'Invalid email or password' }
    }
    return { error: 'Something went wrong — please try again' }
  }
}
