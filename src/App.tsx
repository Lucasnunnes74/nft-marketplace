import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { RealtimeBridge } from '@/app/realtime-bridge'
import { queryClient } from '@/lib/query-client'
import { router } from '@/router'

export default function App({ appRouter = router }: { appRouter?: typeof router }) {
  return (
    <QueryClientProvider client={queryClient}>
      <RealtimeBridge />
      <RouterProvider router={appRouter} />
    </QueryClientProvider>
  )
}
