import { test as base } from '@playwright/test';

/**
 * Fixture customizado que redireciona sessionStorage → localStorage antes de
 * cada teste. Isso permite que o storageState do Playwright (que só persiste
 * localStorage) capture os tokens do oidc-client-ts, sem alterar o código de
 * produção que continua usando sessionStorage.
 */
export const test = base.extend({
    page: async ({ page }, use) => {
        await page.addInitScript(() => {
            // Redireciona window.sessionStorage para window.localStorage
            // O storageState do Playwright persiste apenas localStorage —
            // com este script os tokens OIDC sobrevivem entre testes.
            Object.defineProperty(window, 'sessionStorage', {
                get: () => window.localStorage,
                configurable: true,
            });
        });
        await use(page);
    },
});

export { expect } from '@playwright/test';
