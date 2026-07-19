import { configureStore } from '@reduxjs/toolkit';
import formsReducer from './formSlice';

export const store = configureStore({
  reducer: {
    forms: formsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActionPaths: ['payload.files', 'meta.arg.files'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
