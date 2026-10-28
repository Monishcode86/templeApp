import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

let isRefreshing = false;

/**
 * Functional HTTP Interceptor for centralized error handling and 401 token refresh
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Check for 401 Unauthorized, excluding login or refresh endpoint calls
      const isRefreshRequest = req.url.includes('/api/login/refresh');
      const isLoginRequest = req.url.includes('/api/login') && !req.url.includes('/api/login/me') && !isRefreshRequest;

      if (error.status === 401 && !isRefreshRequest && !isLoginRequest && authService.getRefreshToken()) {
        if (!isRefreshing) {
          isRefreshing = true;

          return authService.refreshToken().pipe(
            switchMap((refreshRes) => {
              isRefreshing = false;
              // Retry original request with newly issued access token
              const newAccessToken = refreshRes.data?.accessToken;
              const retriedReq = req.clone({
                setHeaders: {
                  Authorization: `Bearer ${newAccessToken}`
                }
              });
              return next(retriedReq);
            }),
            catchError((refreshErr) => {
              isRefreshing = false;
              authService.logout();
              return throwError(() => refreshErr);
            })
          );
        }
      }

      // If token is invalid or refresh fails, clear session
      if (error.status === 401 && isRefreshRequest) {
        authService.logout();
      }

      return throwError(() => error);
    })
  );
};
