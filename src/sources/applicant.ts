import { processStandardWebsiteTable } from './-shared';

export function fetchApplicantData(year: number, force = false) {
  return processStandardWebsiteTable({
    year,
    force,
    type: 'applicant',
    selector: 'table#entrantTable',
    fields: {
      id: 'ID',
      firstName: 'First Name',
      lastName: 'Last Name',
      gender: 'Gender',
      age: 'Age',
      state: 'State',
      country: 'Country',
      qualifier: 'Qualifier',
      years: 'Years',
      tickets: 'Tickets',
    },
    scaffold: () => {
      return {
        id: null as string | null,
        firstName: '',
        lastName: '',
        gender: '',
        age: 0,
        state: null as string | null,
        country: null as string | null,
        qualifier: null as string | null,
        years: 0,
        tickets: 0,
      };
    },
    allowNull: ['id', 'country', 'state', 'qualifier'],
    numericFields: ['years', 'tickets', 'age'],
  });
}
