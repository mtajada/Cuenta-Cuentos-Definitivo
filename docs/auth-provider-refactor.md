# Refactorización de AuthProvider con onAuthStateChange

El nuevo `AuthProvider` ya no expone `checkAuth` ni `loginUser`. En su lugar, se suscribe a `supabase.auth.onAuthStateChange` para reaccionar automáticamente a cualquier cambio de sesión.

1. **Carga inicial**: al montarse obtiene `getSession` y establece el estado `loading` hasta completar este paso.
2. **Cambios de sesión**: cualquier `SIGN_IN`, `SIGN_OUT` o `TOKEN_REFRESHED` actualiza `user` y `profileSettings` de forma centralizada.
3. **Navegación**: se mantiene `intendedRedirectPath` para redirigir tras iniciar sesión o completar el perfil, pero ahora la lógica vive dentro del contexto.

Los componentes solo deben usar `useAuth()` y comprobar `loading` o `user`. Esto simplifica la lógica de páginas como `Login`, `AuthCallback` y `Welcome`.
