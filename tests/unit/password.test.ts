import { describe, expect, it } from 'vitest'
import { seedState } from '@/mocks/db'
import { hashPassword } from '@/mocks/password'

describe('senhas do banco simulado', () => {
  it('não guarda texto puro: só hash com sal, diferente por usuário', async () => {
    const a = await hashPassword('user-a', 'Demo@1234')
    const b = await hashPassword('user-b', 'Demo@1234')
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(a).not.toContain('Demo@1234')
    expect(a).not.toBe(b)
    expect(await hashPassword('user-a', 'Demo@1234')).toBe(a)
  })

  it('os usuários de demonstração têm o hash da senha informada no README', async () => {
    for (const user of seedState().users) {
      expect(user.passwordHash).toBe(await hashPassword(user.id, 'Demo@1234'))
      expect(JSON.stringify(user)).not.toContain('Demo@1234')
    }
  })
})
