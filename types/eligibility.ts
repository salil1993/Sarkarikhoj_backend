import type { Scheme } from "@prisma/client";

export type EligibilityCheckInput = {
  age: number;
  gender: string;
  state: string;
  income: number;
  occupation: string;
  category?: string;
};

export type NormalizedEligibilityInput = {
  age: number;
  gender: string;
  state: string;
  income: number;
  occupation: string;
  category?: string;
};

export type EligibleScheme = Scheme;

export type ApiErrorBody = {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type ApiSuccessBody<T> = {
  ok: true;
  data: T;
};
