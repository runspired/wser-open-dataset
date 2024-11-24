import type { PayloadType } from '../-utils';
import type { fetchApplicantData } from '../sources/applicant';
import type { fetchEntrantsData } from '../sources/entrants';
import type { fetchFinishersData } from '../sources/finishers';
import type { fetchWaitlistData } from '../sources/waitlist';

export type ApplicantPayload = ReturnType<
  typeof fetchApplicantData
>[typeof PayloadType];

export type EntrantPayload = ReturnType<
  typeof fetchEntrantsData
>[typeof PayloadType];

export type FinisherPayload = ReturnType<
  typeof fetchFinishersData
>[typeof PayloadType];

export type WaitlistPayload = ReturnType<
  typeof fetchWaitlistData
>[typeof PayloadType];

export { type LivePayload } from '../sources/live';
