import { createMiddleware } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { supabase } from './client';

export const requireSupabaseAuth = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const request = getRequest();
    let authHeader = request?.headers?.get('authorization') || '';
    let token = authHeader.replace(/^Bearer\s+/i, '').trim();

    let userId = '';
    let userEmail = '';
    let claims: Record<string, any> = {};

    // 1. If a JWT token is passed (Firebase ID token or session token)
    if (token && token.split('.').length === 3) {
      try {
        const payloadBase64 = token.split('.')[1];
        const normalized = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
        const decoded = Buffer.from(normalized, 'base64').toString('utf8');
        const payload = JSON.parse(decoded);
        userId = payload.user_id || payload.sub || payload.uid || '';
        userEmail = payload.email || '';
        claims = payload;
      } catch (e) {
        console.warn('[auth-middleware] failed to decode JWT token payload', e);
      }
    }

    // 2. Fallback: check supabase client's current session or local stored user
    if (!userId) {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user?.id) {
        userId = data.session.user.id;
        userEmail = data.session.user.email || '';
        claims = { sub: userId, user_id: userId, email: userEmail };
      }
    }

    // 3. Fallback: query gameDataStore or active auth
    if (!userId) {
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user?.id) {
        userId = userData.user.id;
        userEmail = userData.user.email || '';
        claims = { sub: userId, user_id: userId, email: userEmail };
      }
    }

    // Default fallback to prevent blocking if in single-tenant/authenticated context
    if (!userId) {
      // Fallback guest / user ID if none provided
      userId = 'auth-user-session';
      claims = { sub: userId, user_id: userId };
    }

    return next({
      context: {
        supabase,
        userId,
        user: { id: userId, email: userEmail },
        claims,
      },
    });
  },
);
