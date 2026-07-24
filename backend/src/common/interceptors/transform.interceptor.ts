import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

/**
 * Enveloppe uniformément les réponses réussies : { success, data, timestamp }.
 * Les flux binaires (exports Excel/PDF) sont laissés intacts.
 */
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T> | T>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T> | T> {
    const response = context.switchToHttp().getResponse();
    return next.handle().pipe(
      map((data) => {
        // Ne pas envelopper les réponses de type fichier / stream déjà écrites.
        if (response.getHeader && response.getHeader('Content-Type')) {
          const ct = String(response.getHeader('Content-Type'));
          if (!ct.includes('application/json')) {
            return data;
          }
        }
        return {
          success: true,
          data,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
