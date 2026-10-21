// react-dom llega con react-native-web, sin sus tipos (@types/react-dom). La
// app usa solo flushSync, en web (src/hooks/useCerrarConAtras.web.ts).
declare module 'react-dom' {
  export function flushSync<R>(fn: () => R): R;
}
