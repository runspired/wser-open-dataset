import {
  extractTableData,
  getHtmlIfNeeded,
  inverseMap,
  ticketsToYears,
} from './-shared';

type FinishersResults = {
  data: FinishersList;
  included: Finisher[];
};

type FinishersList = {
  type: 'finishers-list';
  id: string;
  attributes: {
    year: number;
  };
  relationships: {
    applicants: {
      data: Array<{ type: 'finisher'; id: string }>;
    };
  };
};

type Finisher = {
  type: 'finisher';
  id: string;
  attributes: {
    place: number | null;
    time: string;
    bib: string | null;
    firstName: string;
    lastName: string;
    gender: string;
    age: number | null;
    city: string | null;
    stateOrCountry: string | null;
  };
};

type FinisherField = keyof Finisher['attributes'];

const FieldMappingDict = {
  place: 'Place',
  time: 'Time',
  bib: 'Bib',
  firstName: ['First', 'First Name'],
  lastName: ['Last', 'Last Name'],
  gender: 'Gender',
  age: 'Age',
  city: 'City',
  stateOrCountry: ['State/Country', 'State or Country', 'State'],
};
const InverseFieldMap = inverseMap(FieldMappingDict);

function isNumberField(field: FinisherField): field is 'place' | 'age' {
  return field === 'age' || field === 'place';
}

function isAllowedBlank(
  field: FinisherField,
): field is 'city' | 'stateOrCountry' | 'place' | 'age' | 'bib' {
  return (
    field === 'city' ||
    field === 'stateOrCountry' ||
    field === 'place' ||
    field === 'age' ||
    field === 'bib'
  );
}

function scaffoldFinisher(year: number, index: number): Finisher {
  return {
    type: 'finisher',
    id: `${year}:${index}`,
    attributes: {
      place: 0,
      time: '',
      bib: '',
      firstName: '',
      lastName: '',
      gender: '',
      age: 0,
      city: '',
      stateOrCountry: '',
    },
  };
}

export async function fetchFinishersData(
  year: number,
  force = false,
): Promise<FinishersResults> {
  const info = await getHtmlIfNeeded<FinishersResults>(
    `https://www.wser.org/results/${String(year)}-results/`,
    `./.data-cache/raw/${year}/finishers.json`,
    force,
  );

  if (info.data) {
    return info.data;
  }

  const rawJson = await extractTableData(info, '#content table');
  const entrants: Finisher[] = [];
  const entrantRefs: Array<{ type: 'finisher'; id: string }> = [];
  const result: FinishersResults = {
    data: {
      type: 'finishers-list',
      id: `${year}`,
      attributes: {
        year,
      },
      relationships: {
        applicants: {
          data: entrantRefs,
        },
      },
    },
    included: entrants,
  };

  const labels = rawJson.labels.map((text) => {
    const label = InverseFieldMap.get(text) ?? null;

    if (!label) {
      throw new Error(`Invalid label: ${text} in year ${year}`);
    }
    return label;
  });

  for (let rowIndex = 0; rowIndex < rawJson.data.length; rowIndex++) {
    const row = rawJson.data[rowIndex];
    const { index, data } = row;

    // generate the entrant object
    const entrant = scaffoldFinisher(year, index);

    for (let i = 0; i < data.length; i++) {
      const value = data[i];
      const label = labels[i];

      if (!value && isAllowedBlank(label)) {
        entrant.attributes[label] = null;
        continue;
      }

      if (!value) {
        throw new Error(
          `Missing value for field ${label} in cell ${i} on row ${index} in year ${year}`,
        );
      }

      if (isNumberField(label)) {
        entrant.attributes[label] = Number(value);
        continue;
      }

      entrant.attributes[label] = value;
    }

    const { type, id } = entrant;
    entrants.push(entrant);
    entrantRefs.push({ type, id });
  }

  if (entrants.length === 0) {
    console.warn(`⚠️ No finishers found for year ${year}`);
  }

  await Bun.write(info.file, JSON.stringify(result, null, 2));

  return result;
}
