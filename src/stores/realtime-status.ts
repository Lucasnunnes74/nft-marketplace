import { createStore } from './create-store'

export type RealtimeStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline'
export const realtimeStatus = createStore<RealtimeStatus>('offline')
