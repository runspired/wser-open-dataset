import { processStandardWebsiteTable } from './-shared';

export function fetchWaitlistData(year: number, force = false) {
  return processStandardWebsiteTable({
    year,
    force,
    type: 'waitlist',
    fields: {
      order: 'Order',
      status: 'Status',
      firstName: ['First Name', 'First'],
      lastName: ['Last Name', 'Last'],
      gender: 'Gender',
      age: 'Age',
      city: 'City',
      state: 'State',
      country: 'Country',
      tickets: ['Tickets', 'Ticket Count'],
      years: ['Years', 'Years In Lottery', 'Years in Lottery'],
      bib: 'Bib',
    },
    scaffold: () => {
      return {
        order: 0,
        status: null as string | null,
        firstName: '',
        lastName: '',
        gender: '',
        age: 0 as number | null,
        city: '',
        state: '',
        country: '',
        tickets: 0,
        years: 0,
        bib: null as string | null,
      };
    },
    allowNull: ['status', 'age', 'bib'],
    numericFields: ['age', 'order', 'years', 'tickets'],
  });
}
