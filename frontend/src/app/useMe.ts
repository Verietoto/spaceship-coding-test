// Who is logged in: used to show admin-only parts (the server still enforces them).
import { useApi } from './useApi'

export function useMe() {
  const { data } = useApi<{ email: string; role: 'admin' | 'visitor' }>('me')
  return { me: data, isAdmin: data?.role === 'admin' }
}
