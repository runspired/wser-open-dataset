import { processStandardWebsiteTable } from './-shared';

export function fetchEntrantsData(year: number, force = false) {
  return processStandardWebsiteTable({
    year,
    force,
    type: 'entrant',
    fields: {
      firstName: 'First Name',
      lastName: 'Last Name',
      gender: ['gender', 'Gender'],
      awards: 'Awards',
      age: 'Age',
      city: 'City',
      state: 'State',
      country: 'Country',
      bib: ['bib', 'Bib'],
      entryType: 'Entry Type',
      priorFinishes: 'WS Finishes',
      rollover: 'Rollover',
    },
    scaffold: () => {
      return {
        firstName: '',
        lastName: '',
        gender: '',
        awards: null as string | null,
        age: 0,
        city: null as string | null,
        state: null as string | null,
        country: '',
        bib: '',
        entryType: null as string | null,
        priorFinishes: null as number | null,
        rollover: null as string | null,
      };
    },
    allowNull: [
      'awards',
      'city',
      'state',
      'entryType',
      'priorFinishes',
      'rollover',
    ],
    numericFields: ['age', 'priorFinishes'],
  });
}
