import { extractTableData, getHtmlIfNeeded, ticketsToYears } from './-shared';

type EntrantsResult = {
  data: EntrantsList;
  included: Entrant[];
};

type EntrantsList = {
  type: 'entrants-list';
  id: string;
  attributes: {
    year: number;
  };
  relationships: {
    applicants: {
      data: Array<{ type: 'entrant'; id: string }>;
    };
  };
};

type Entrant = {
  type: 'entrant';
  id: string;
  attributes: {
    firstName: string;
    lastName: string;
    gender: string;
    awards: string | null;
    age: number;
    city: string | null;
    state: string | null;
    country: string;
    bib: string;
    entryType: string | null;
    priorFinishes: number | null;
    rollover: string | null;
  };
};

type EntrantField = keyof Entrant['attributes'];

const FieldMappingDict = {
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
} as const;

const InverseFieldMap = new Map<string, EntrantField>();
for (const [key, value] of Object.entries(FieldMappingDict)) {
  if (Array.isArray(value)) {
    for (const v of value) {
      InverseFieldMap.set(v, key as EntrantField);
    }
  } else {
    InverseFieldMap.set(value as string, key as EntrantField);
  }
}

function isNumberField(field: EntrantField): field is 'age' | 'priorFinishes' {
  return field === 'age' || field === 'priorFinishes';
}

function isAllowedBlank(
  field: EntrantField,
): field is
  | 'priorFinishes'
  | 'entryType'
  | 'city'
  | 'awards'
  | 'state'
  | 'rollover' {
  return (
    field === 'priorFinishes' ||
    field === 'entryType' ||
    field === 'city' ||
    field === 'awards' ||
    field === 'state' ||
    field === 'rollover'
  );
}

function scaffoldEntrant(year: number, index: number): Entrant {
  return {
    type: 'entrant',
    id: `${year}:${index}`,
    attributes: {
      firstName: '',
      lastName: '',
      gender: '',
      awards: null,
      age: 0,
      city: null,
      state: null,
      country: '',
      bib: '',
      entryType: null,
      priorFinishes: null,
      rollover: null,
    },
  };
}

export async function fetchEntrantsData(
  year: number,
  force = false,
): Promise<EntrantsResult> {
  const info = await getHtmlIfNeeded<EntrantsResult>(
    `https://www.wser.org/${String(year)}-entrants-list/`,
    `./.data-cache/raw/${year}/entrants.json`,
    force,
  );

  if (info.data) {
    return info.data;
  }

  const rawJson = await extractTableData(info, '#content table');
  const entrants: Entrant[] = [];
  const entrantRefs: Array<{ type: 'entrant'; id: string }> = [];
  const result: EntrantsResult = {
    data: {
      type: 'entrants-list',
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
    const entrant = scaffoldEntrant(year, index);

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

  await Bun.write(info.file, JSON.stringify(result, null, 2));

  return result;
}
