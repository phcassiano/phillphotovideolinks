import { useRouteLoaderData } from 'react-router';
import type { loader } from '~/root';

export type RootData = Awaited<ReturnType<typeof loader>>['data'];

export function useRootData() {
  return useRouteLoaderData('root') as RootData;
}
