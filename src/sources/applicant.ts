import {
  extractTableData,
  getHtmlIfNeeded,
  inverseMap,
  ticketsToYears,
} from './-shared';

type YearlyLottery = {
  type: 'lottery';
  id: string;
  attributes: {
    year: number;
  };
  relationships: {
    applicants: {
      data: Array<{ type: 'lottery-applicant'; id: string }>;
    };
  };
};

type Applicant = {
  id: string;
  type: 'lottery-applicant';
  attributes: {
    firstName: string;
    lastName: string;
    gender: string;
    age: string;
    state: string | null;
    country: string | null;
    qualifier: string | null;
    years: number;
    tickets: number;
  };
  relationships: {
    entrant: {
      data: { type: 'entrant'; id: string } | null;
    };
  };
};

type LotteryResult = {
  data: YearlyLottery;
  included: Applicant[];
};

type EntrantField = keyof Applicant['attributes'] | 'id';

const ApplicantFieldMappingDict = {
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
};

const ApplicantFieldTransformMap = new Map(
  Object.entries(ApplicantFieldMappingDict),
) as Map<EntrantField, string>;
const ApplicantFieldReverseTransformMap = inverseMap(ApplicantFieldMappingDict);

function isNumberField(field: EntrantField): field is 'years' | 'tickets' {
  return field === 'years' || field === 'tickets';
}
function isAllowedBlank(field: EntrantField): field is 'country' | 'state' {
  return field === 'country' || field === 'state';
}

function scaffoldApplicant(year: number, index: number): Applicant {
  return {
    type: 'lottery-applicant',
    id: `${year}:${index}`,
    attributes: {
      firstName: '',
      lastName: '',
      gender: '',
      age: '',
      state: '',
      country: null,
      qualifier: null,
      years: 0,
      tickets: 0,
    },
    relationships: {
      entrant: {
        data: null,
      },
    },
  };
}

export async function fetchApplicantData(
  year: number,
  force = false,
): Promise<LotteryResult> {
  const info = await getHtmlIfNeeded<LotteryResult>(
    `https://www.wser.org/lottery${String(year)}.html`,
    `./.data-cache/raw/${year}/applicants.json`,
    force,
  );

  if (info.data) {
    return info.data;
  }

  const rawJson = await extractTableData(info, 'table#entrantTable');
  const entrants: Applicant[] = [];
  const entrantRefs: Array<{ type: 'lottery-applicant'; id: string }> = [];
  const result: LotteryResult = {
    data: {
      type: 'lottery',
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
    const label =
      ApplicantFieldReverseTransformMap.get(text) ??
      (ApplicantFieldTransformMap.has(text as EntrantField)
        ? (text as EntrantField)
        : null);

    if (!label) {
      throw new Error(`Invalid label: ${text}`);
    }
    return label;
  });

  for (let rowIndex = 0; rowIndex < rawJson.data.length; rowIndex++) {
    const row = rawJson.data[rowIndex];
    const { index, data } = row;

    // generate the entrant object
    const entrant = scaffoldApplicant(year, index);

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

      if (label === 'id') {
        entrant.relationships.entrant.data = { type: 'entrant', id: value };
        continue;
      }

      if (isNumberField(label)) {
        entrant.attributes[label] = Number(value);
        continue;
      }

      entrant.attributes[label] = value;
    }

    // fix the years field
    if (entrant.attributes.years === 0) {
      entrant.attributes.years = ticketsToYears(entrant.attributes.tickets);
    }

    const { type, id } = entrant;
    entrants.push(entrant);
    entrantRefs.push({ type, id });
  }

  await Bun.write(info.file, JSON.stringify(result, null, 2));

  return result;
}
