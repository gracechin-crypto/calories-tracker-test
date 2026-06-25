import { logout } from '@/app/actions/auth'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-4xl font-bold tracking-tight">Calories Tracker</h1>
      <p className="text-lg text-gray-500">Ready.</p>
      <form action={logout}>
        <button
          type="submit"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          Log out
        </button>
      </form>
    </main>
  )
}
