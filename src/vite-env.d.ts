/// <reference types="vite/client" />

declare global {
  namespace JSX {
    interface IntrinsicElements {
      form: React.DetailedHTMLProps<React.FormHTMLAttributes<HTMLFormElement>, HTMLFormElement> & {
        netlify?: boolean;
        name?: string;
      };
    }
  }
}

declare module 'react' {
  interface FormHTMLAttributes<T> {
    netlify?: boolean;
  }
}

interface Window {
  clearCurrentOrder?: () => void;
}