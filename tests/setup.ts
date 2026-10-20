import '@testing-library/jest-dom/vitest'
import { configure } from '@testing-library/react'

// Rotas lazy + dados simulados com latência: 1s padrão é curto para fluxos completos.
configure({ asyncUtilTimeout: 5000 })

// jsdom não implementa estas APIs usadas pelo roteador/UI.
window.scrollTo = () => {}
Element.prototype.scrollTo = () => {}
Element.prototype.scrollIntoView = () => {}
