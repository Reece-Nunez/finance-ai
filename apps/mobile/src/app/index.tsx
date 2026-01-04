import { Redirect } from 'expo-router'

export default function Index() {
  // Redirect to tabs - the auth provider will handle redirecting to login if not authenticated
  return <Redirect href="/(tabs)" />
}
