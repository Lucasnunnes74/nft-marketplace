/**
 * Senhas nunca ficam em texto puro: o banco simulado guarda apenas SHA-256(`id:senha`).
 * O id do usuário faz o papel de sal. É suficiente para a simulação; um backend real usaria
 * um algoritmo lento próprio para senhas (argon2, bcrypt ou scrypt).
 */
export async function hashPassword(userId: string, password: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${userId}:${password}`))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
