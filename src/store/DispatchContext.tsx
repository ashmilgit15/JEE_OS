'use client';

import { createContext, useContext } from 'react';
import type React from 'react';
import type { Action } from './index';

// A dedicated context for the store's `dispatch` function.
//
// `dispatch` from useReducer is referentially stable for the life of the
// provider, so components that only need to dispatch actions can subscribe to
// THIS context and never re-render when app state changes. This is the key
// lever for cutting the re-render fan-out of the monolithic store.
//
// Provided by StoreProvider (src/store/index.tsx); consume via useDispatch().

export type StoreDispatch = React.Dispatch<Action>;

export const DispatchContext = createContext<StoreDispatch | null>(null);

export function useDispatch(): StoreDispatch {
  const dispatch = useContext(DispatchContext);
  if (!dispatch) throw new Error('useDispatch must be used within StoreProvider');
  return dispatch;
}
