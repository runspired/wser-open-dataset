import { processStandardWebsiteTable } from './-shared';

export function fetchFinishersData(year: number, force = false) {
  return processStandardWebsiteTable({
    year,
    force,
    type: 'finisher',
    fields: {
      place: 'Place',
      time: 'Time',
      bib: 'Bib',
      firstName: ['First', 'First Name'],
      lastName: ['Last', 'Last Name'],
      gender: 'Gender',
      age: 'Age',
      city: 'City',
      stateOrCountry: ['State/Country', 'State or Country', 'State'],
    },
    scaffold: () => {
      return {
        place: 0 as number | null,
        time: '',
        bib: '' as string | null,
        firstName: '',
        lastName: '',
        gender: '',
        age: 0 as number | null,
        city: '' as string | null,
        stateOrCountry: '' as string | null,
      };
    },
    allowNull: ['city', 'stateOrCountry', 'place', 'age', 'bib'],
    numericFields: ['age', 'place'],
  });
}
