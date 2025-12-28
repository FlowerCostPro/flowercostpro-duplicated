import { ReactNode, FormEvent, ChangeEvent, MouseEvent } from 'react';

// Common component props
export interface BaseComponentProps {
  children?: ReactNode;
  className?: string;
}

// Event handler types
export interface FormEventHandler {
  (event: FormEvent<HTMLFormElement>): void;
}

export interface ChangeEventHandler {
  (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>): void;
}

export interface ClickEventHandler {
  (event: MouseEvent<HTMLButtonElement | HTMLAnchorElement>): void;
}

// Common function parameter types
export interface StringCallback {
  (value: string): void;
}

export interface NumberCallback {
  (value: number): void;
}

export interface BooleanCallback {
  (value: boolean): void;
}

export interface VoidCallback {
  (): void;
}

// User role type
export type UserRole = 'owner' | 'manager' | 'staff';

// Generic ID type
export type ID = string;