import {
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse
} from '@angular/common/http';
import { EMPTY, Observable, merge, of } from 'rxjs';
import { catchError, filter, tap } from 'rxjs/operators';

type CachedResponse = HttpResponse<unknown>;

const responseCache = new Map<string, CachedResponse>();
const cacheableEndpointPattern = /\/(?:expenses|categories)\/?$/;

function isCacheableRequest(request: HttpRequest<unknown>): boolean {
  if (request.method !== 'GET') {
    return false;
  }

  const pathname = new URL(request.urlWithParams, 'http://localhost').pathname;
  return cacheableEndpointPattern.test(pathname);
}

function getCacheKey(request: HttpRequest<unknown>): string {
  // Keep data isolated when the authenticated user changes.
  return `${request.urlWithParams}::${request.headers.get('Authorization') ?? ''}`;
}

export const cacheInterceptor: HttpInterceptorFn = (
  request: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  if (!isCacheableRequest(request)) {
    return next(request);
  }

  const cacheKey = getCacheKey(request);
  const cachedResponse = responseCache.get(cacheKey);
  const networkRequest = next(request).pipe(
    tap((event) => {
      if (event instanceof HttpResponse) {
        responseCache.set(cacheKey, event.clone());
      }
    })
  );

  if (!cachedResponse) {
    return networkRequest;
  }

  return merge(
    of(cachedResponse.clone()),
    networkRequest.pipe(
      // Stale data remains usable if the background refresh fails.
      catchError(() => EMPTY)
    )
  );
};
