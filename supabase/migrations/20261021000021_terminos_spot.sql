-- =============================================================================
-- 0021 · La app pasa a llamarse Spot
-- Los términos y la política de privacidad nombran la app (t.legal en
-- src/i18n/es-UY.ts): cambió el texto, así que todos vuelven a aceptarlos
-- antes de publicar, avisar, cambiar un estado, escribir o denunciar. Igual a
-- VERSION_TERMINOS de src/features/legal/terminos.ts (lo comprueba
-- __tests__/marca.test.ts).
-- Ver docs/DECISIONES.md, "La app pasa a llamarse Spot".
-- =============================================================================

update public.config_app set valor = '2026-10-21', updated_at = now()
where clave = 'terminos_version';
