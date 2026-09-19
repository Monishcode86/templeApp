import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/**
 * Functional HTTP Interceptor to attach Bearer JWT to outgoing requests
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getAccessToken();

  // Attach token to /api endpoints when token is present and not an unauthenticated endpoint
  const isApiRequest = req.url.includes('/api/');
  const isAuthEndpoint = req.url.includes('/api/login') && !req.url.includes('/api/login/me');

  if (token && isApiRequest && !isAuthEndpoint) {
    const authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    return next(authReq);
  }

  return next(req);
};
