import app from '../_lib/app';
import type { Env } from '../_lib/types';

export const onRequest: PagesFunction<Env> = (context) => {
  return app.fetch(context.request, context.env);
};
