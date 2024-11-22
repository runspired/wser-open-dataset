import { JSDOM } from 'jsdom';

type WaitlistEntrant = {
    id: string;
    type: 'waitlist-entrant';
    attributes: {
        order: number;
        status: string;
        firstName: string;
        lastName: string;
        gender: string;
        age: string;
        city: string;
        state: string;
        country: string;
        years: number;
    };
}